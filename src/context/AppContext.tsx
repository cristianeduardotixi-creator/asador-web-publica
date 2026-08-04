import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type {
  Category,
  Printer,
  Product,
  RestaurantTable,
  SettingsMap,
  Waiter,
  Role,
  Order,
} from '@/lib/types';
import {
  fetchCategories,
  fetchProducts,
  fetchWaiters,
  fetchTables,
  fetchPrinters,
  fetchSettings,
  fetchActiveOrdersWithItems,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { checkNetwork, type NetworkState } from '@/lib/network';

interface AppContextValue {
  categories: Category[];
  products: Product[];
  waiters: Waiter[];
  tables: RestaurantTable[];
  tableOrders: Record<string, Order>;
  refreshOrders: () => Promise<void>;
  printers: Printer[];
  settings: SettingsMap;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  role: Role | null;
  waiter: Waiter | null;
  login: (role: Role, waiter?: Waiter) => void;
  logout: () => void;
  network: NetworkState | null;
  networkEnforce: 'strict' | 'demo';
  setNetworkEnforce: (m: 'strict' | 'demo') => void;
  refreshNetwork: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tableOrders, setTableOrders] = useState<Record<string, Order>>({});
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [networkEnforce, setNetworkEnforceState] = useState<'strict' | 'demo'>('demo');

  const setNetworkEnforce = useCallback((m: 'strict' | 'demo') => {
    setNetworkEnforceState(m);
    supabase.from('settings').upsert({ key: 'network_enforce', value: m, updated_at: new Date().toISOString() }).catch(() => {});
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      // Use allSettled so one failed table doesn't crash the whole app.
      const results = await Promise.allSettled([
        fetchCategories(),
        fetchProducts(),
        fetchWaiters(),
        fetchTables(),
        fetchPrinters(),
        fetchSettings(),
        fetchActiveOrdersWithItems(),
      ]);
      const labels = ['categories', 'products', 'waiters', 'tables', 'printers', 'settings', 'orders'];
      const failures: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          switch (i) {
            case 0: setCategories(r.value as Category[]); break;
            case 1: setProducts(r.value as Product[]); break;
            case 2: setWaiters(r.value as Waiter[]); break;
            case 3: setTables(r.value as RestaurantTable[]); break;
            case 4: setPrinters(r.value as Printer[]); break;
            case 5: {
              const stt = r.value as SettingsMap;
              setSettings(stt);
              if (stt.network_enforce === 'demo' || stt.network_enforce === 'strict') {
                setNetworkEnforceState(stt.network_enforce);
              }
              break;
            }
            case 6: syncTableOrders(r.value as Order[]); break;
          }
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`[AppContext] Error cargando ${labels[i]}:`, msg);
          failures.push(`${labels[i]}: ${msg}`);
        }
      }
      // Only show error screen if critical tables (products, tables, categories) all failed
      const criticalFailed = [0, 1, 3].every((i) => results[i].status === 'rejected');
      if (criticalFailed) {
        setError(failures.join('\n'));
      } else if (failures.length > 0) {
        // Log non-critical failures but don't block the app
        console.warn('[AppContext] Fallos parciales:', failures.join('; '));
      }
    } catch (e) {
      console.error('[AppContext] Error fatal cargando datos:', e);
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadSettings = useCallback(async () => {
    const stt = await fetchSettings();
    setSettings(stt);
  }, []);

  const syncTableOrders = useCallback((orders: Order[]) => {
    // A table may have multiple orders during a sitting (e.g. drinks first,
    // then food). Merge all active orders + items per table so the UI shows
    // the full consumption history, not just the last order.
    // Orders are fetched oldest-first; items within each order are sorted by
    // created_at. The merged list preserves chronological order across rounds.
    const byTable: Record<string, Order> = {};
    for (const o of orders) {
      if ((o.status === 'open' || o.status === 'sent') && o.table_id) {
        const existing = byTable[o.table_id];
        if (existing) {
          // Merge items and recalculate totals
          const mergedItems = [...(existing.items ?? []), ...(o.items ?? [])]
            .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
          const mergedTotal = mergedItems
            .filter((it) => it.status !== 'cancelled')
            .reduce((s, it) => s + it.price * it.quantity, 0);
          byTable[o.table_id] = {
            ...existing,
            items: mergedItems,
            total: mergedTotal,
            subtotal: mergedTotal,
            // Keep the earliest order's id as the canonical reference
            id: existing.created_at < o.created_at ? existing.id : o.id,
          };
        } else {
          const activeItems = (o.items ?? [])
            .filter((it) => it.status !== 'cancelled')
            .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
          const total = activeItems.reduce((s, it) => s + it.price * it.quantity, 0);
          byTable[o.table_id] = { ...o, items: activeItems, total, subtotal: total };
        }
      }
    }
    setTableOrders(byTable);
  }, []);

  const refreshOrders = useCallback(async () => {
    const orders = await fetchActiveOrdersWithItems();
    syncTableOrders(orders);
    await fetchTables().then(setTables).catch(() => {});
  }, [syncTableOrders]);

  const refreshNetwork = useCallback(async () => {
    const prefix = settings.local_ip_prefix || '192.168.1.';
    const agent = settings.print_agent_url || '';
    const st = await checkNetwork(prefix, agent);
    setNetwork(st);
  }, [settings.local_ip_prefix, settings.print_agent_url]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (settings.local_ip_prefix) refreshNetwork();
  }, [settings.local_ip_prefix, refreshNetwork]);

  // Realtime: subscribes to tables, orders, order_items, and printers changes
  // so all devices see comandas and table states update automatically.
  useEffect(() => {
    const channel = supabase
      .channel('tpv-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        fetchTables().then(setTables).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        refreshOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts().then(setProducts).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories().then(setCategories).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printers' }, () => {
        fetchPrinters().then(setPrinters).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((r: Role, w?: Waiter) => {
    setRole(r);
    setWaiter(w ?? null);
  }, []);

  const logout = useCallback(() => {
    setRole(null);
    setWaiter(null);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadAll();
  }, [loadAll]);

  return (
    <AppContext.Provider
      value={{
        categories, products, waiters, tables, tableOrders, refreshOrders, printers, settings,
        loading, error, reload, reloadSettings,
        role, waiter, login, logout,
        network, networkEnforce, setNetworkEnforce, refreshNetwork,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
