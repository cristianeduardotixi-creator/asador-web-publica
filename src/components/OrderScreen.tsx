import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, StickyNote, X,
  Check, Ban, Trash2, Minus, Send, Receipt, Loader2, AlertCircle,
  Printer, Package, Link2, ArrowLeftRight, ShieldAlert,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Order, OrderItem, Product, RestaurantTable, Waiter, Role } from '@/lib/types';
import { Button, Modal, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import {
  getOrCreateActiveOrder, batchAddOrderItems, fetchOrderItems,
  sendOrder, setTableStatus, updateOrderItem, mergeTable, unmergeTable,
  cancelOrderItem, moveTable,
} from '@/lib/api';
import { printComanda, printPrecuenta, printAnulacion, type PrecuentaPrintResult } from '@/lib/print';

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? LucideIcons.UtensilsCrossed;
  return <Icon className={className} />;
}

const CAT_COLOR_CLASSES: Record<string, { active: string; badge: string }> = {
  red:    { active: 'bg-red-500 text-white shadow-md',          badge: 'bg-red-700' },
  green:  { active: 'bg-green-500 text-white shadow-md',        badge: 'bg-green-700' },
  amber:  { active: 'bg-amber-500 text-white shadow-md',        badge: 'bg-amber-700' },
  orange: { active: 'bg-orange-500 text-white shadow-md',       badge: 'bg-orange-700' },
  cyan:   { active: 'bg-cyan-500 text-white shadow-md',         badge: 'bg-cyan-700' },
  teal:   { active: 'bg-teal-500 text-white shadow-md',         badge: 'bg-teal-700' },
  sky:    { active: 'bg-sky-500 text-white shadow-md',          badge: 'bg-sky-700' },
  stone:  { active: 'bg-stone-500 text-white shadow-md',        badge: 'bg-stone-700' },
};
function catColor(c: { color?: string }) {
  return CAT_COLOR_CLASSES[c.color ?? 'amber'] ?? CAT_COLOR_CLASSES.amber;
}

function formatTableName(t: RestaurantTable): string {
  const match = t.name.match(/^[A-Za-z]+(\d+)$/);
  if (match) return `${t.section} ${match[1]}`;
  return t.name;
}

interface CartLine {
  product: Product;
  quantity: number;
  notes: string;
  takeaway: boolean;
}

const TAKEAWAY_SUPPLEMENT = 1;
const lineUnitPrice = (l: CartLine) => l.product.price + (l.takeaway ? TAKEAWAY_SUPPLEMENT : 0);

const NOTE_SUGGESTIONS = ['Poco hecho', 'Muy hecho', 'Sin cebolla', 'Salsa aparte', 'Sin sal', 'Bien cocido'];

const DRINK_SUBCATEGORIES = [
  'Todos',
  'Bebidas grandes',
  'Bote',
  'Tercio',
  'Botellín',
  'Cubos',
  'Cafés',
  'Tés',
  'Batidos',
  'Varios',
];

export function OrderScreen({
  table,
  onBack,
  role = 'waiter',
  onPay,
}: {
  table: RestaurantTable;
  onBack: () => void;
  role?: Role;
  onPay?: (table: RestaurantTable) => void;
}) {
  const { categories, products, waiter, waiters, printers, settings, network, networkEnforce, tables, tableOrders, refreshOrders } = useApp();
  const isAdmin = role === 'admin';
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedDrinkSub, setSelectedDrinkSub] = useState<string>('Todos');
  const [selectedWaiter, setSelectedWaiter] = useState<Waiter | null>(waiter);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [covers] = useState(table.seats > 4 ? 4 : table.seats);
  const [orderNotes] = useState('');
  const [noteModal, setNoteModal] = useState<
    | { type: 'cart'; idx: number; product: Product }
    | { type: 'existing'; itemId: string; productName: string }
    | null
  >(null);
  const [noteText, setNoteText] = useState('');
  const [productModal, setProductModal] = useState<{ product: Product; quantity: number; takeaway: boolean; notes: string } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [flashSent, setFlashSent] = useState(false);
  const [printingPrecuenta, setPrintingPrecuenta] = useState(false);
  const [precuentaPreview, setPrecuentaPreview] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showMoveTable, setShowMoveTable] = useState(false);

  const mergedTables = tables.filter((x) => x.merged_into === table.id);
  const isMergedChild = !!table.merged_into;

  const activeOrder = table.id ? tableOrders[table.id] ?? null : null;
  const orderId = activeOrder?.id ?? null;
  const existingItems: OrderItem[] = activeOrder?.items ?? [];
  const orderIdRef = useRef<string | null>(orderId);
  orderIdRef.current = orderId;

  const pendingTotal = activeOrder?.total ?? 0;
  const blockedByNetwork = networkEnforce === 'strict' && network?.checked && !network.onLan;

  const sortedCats = useMemo(() => {
    return [...categories]
      .filter((c) => {
        const name = c.name.toLowerCase();
        return !name.includes('cafés y tés') && !name.includes('cafes y tes');
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categories]);

  useEffect(() => {
    if (!activeCat && sortedCats.length > 0) {
      setActiveCat(sortedCats[0].id);
    }
  }, [sortedCats, activeCat]);

  const activeCategoryObj = sortedCats.find((c) => c.id === activeCat);
  const isDrinksCategory = activeCategoryObj?.name.toLowerCase() === 'bebidas';

  const filteredProducts = useMemo(() => {
    if (!activeCat) return [];
    const baseList = products.filter((p) => p.category_id === activeCat && p.available);
    if (!isDrinksCategory || selectedDrinkSub === 'Todos') return baseList;

    const sub = selectedDrinkSub.toLowerCase();
    return baseList.filter((p) => {
      const name = p.name.toLowerCase();
      
      // Evitar que los cubos aparezcan en botellines o tercios
      const isCubo = name.includes('cubo');
      if (isCubo && sub !== 'cubos') return false;

      if (sub === 'bebidas grandes') {
        return name.includes('2l') || name.includes('jarra personal');
      }
      if (sub === 'bote') {
        return (name.startsWith('bote ') || (name.includes('coca cola') && !name.includes('2l')) || name.includes('nestea') || name.includes('aquarius') || name.includes('sprite') || name.includes('fanta')) && !isCubo;
      }
      if (sub === 'tercio') {
        return name.includes('tercio') && !name.includes('sin alcohol') && !name.includes('botellín') && !isCubo;
      }
      if (sub === 'botellín') {
        return (name.includes('botellín') || name.includes('botellin')) && !isCubo;
      }
      if (sub === 'cubos') {
        return isCubo;
      }
      if (sub === 'cafés') {
        return name.includes('café') || name.includes('cafe');
      }
      if (sub === 'tés') {
        return name.includes('té') || name.includes('tea') || name.includes('manzanilla') || name.includes('poleo') || name.includes('tila') || name.includes('jengibre');
      }
      if (sub === 'batidos') {
        return name.includes('batido');
      }
      if (sub === 'varios') {
        return name.includes('agua');
      }
      return true;
    });
  }, [products, activeCat, isDrinksCategory, selectedDrinkSub]);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const existingTotal = useMemo(
    () => existingItems.reduce((s, it) => s + it.price * it.quantity, 0),
    [existingItems],
  );
  const grandTotal = existingTotal + cartTotal;

  function openProductModal(p: Product) {
    setProductModal({ product: p, quantity: 1, takeaway: false, notes: '' });
  }

  function addFromModal() {
    if (!productModal) return;
    const { product, quantity, takeaway, notes } = productModal;
    setCart((c) => {
      if (!notes) {
        const idx = c.findIndex((l) => l.product.id === product.id && !l.notes && l.takeaway === takeaway);
        if (idx >= 0) {
          const copy = [...c];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + quantity };
          return copy;
        }
      }
      return [...c, { product, quantity, notes, takeaway }];
    });
    setProductModal(null);
  }

  function changeQty(idx: number, delta: number) {
    setCart((c) => {
      const copy = [...c];
      const q = copy[idx].quantity + delta;
      if (q <= 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...copy[idx], quantity: q };
      return copy;
    });
  }

  function removeLine(idx: number) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }

  function openNote(idx: number) {
    setNoteModal({ type: 'cart', idx, product: cart[idx].product });
    setNoteText(cart[idx].notes);
  }

  function openExistingNote(it: OrderItem) {
    setNoteModal({ type: 'existing', itemId: it.id, productName: it.product_name });
    setNoteText(it.notes ?? '');
  }

  function saveNote() {
    if (!noteModal) return;
    if (noteModal.type === 'cart') {
      setCart((c) => {
        const copy = [...c];
        copy[noteModal.idx] = { ...copy[noteModal.idx], notes: noteText };
        return copy;
      });
    } else {
      const itemId = noteModal.itemId;
      updateOrderItem(itemId, { notes: noteText || null })
        .then(() => refreshOrders())
        .catch((e) => setError(e instanceof Error ? e.message : 'Error al guardar nota'));
    }
    setNoteModal(null);
    setNoteText('');
  }

  function toggleTakeaway(idx: number) {
    setCart((c) => {
      const copy = [...c];
      copy[idx] = { ...copy[idx], takeaway: !copy[idx].takeaway };
      return copy;
    });
  }

  function requestCancel(it: OrderItem) {
    setCancelTarget(it);
    setPinInput('');
    setPinError(null);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    if (pinInput !== '2468') {
      setPinError('PIN incorrecto. Solo Admin puede anular items enviados.');
      return;
    }
    setCancelBusy(true);
    setPinError(null);
    try {
      const canceled = await cancelOrderItem(cancelTarget.id);
      await refreshOrders();
      if (activeOrder) {
        printAnulacion(activeOrder, canceled, printers, settings.print_agent_url || '', {
          commercialName: settings.restaurant_name ?? '',
          legalName: settings.restaurant_legal_name ?? '',
          nif: settings.restaurant_nif ?? '',
          address: settings.restaurant_address ?? '',
          postalCode: settings.restaurant_postal_code ?? '',
          phone: settings.restaurant_phone ?? '',
          email: settings.restaurant_email ?? '',
        }).catch(() => {});
      }
      setCancelTarget(null);
      setPinInput('');
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Error al anular item');
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleMoveTable(toTable: RestaurantTable) {
    try {
      await moveTable(table.id, toTable.id);
      await refreshOrders();
      setShowMoveTable(false);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al mover mesa');
    }
  }

  async function addItemsToOrder(orderId: string, lines: CartLine[]): Promise<OrderItem[]> {
    return batchAddOrderItems(orderId, lines);
  }

  function handleSend() {
    if (cart.length === 0) return;
    const snapshot = [...cart];

    setCart([]);
    setFlashSent(true);

    (async () => {
      try {
        const order = await getOrCreateActiveOrder({
          table_id: table.id,
          table_name: table.name,
          waiter_id: waiter?.id ?? null,
          waiter_name: waiter?.name ?? null,
          covers,
          notes: orderNotes,
        });
        const oid = order.id;
        orderIdRef.current = oid;

        const insertedItems = await addItemsToOrder(oid, snapshot);
        const { order: latestOrder } = await sendOrder(oid, table.id);
        await setTableStatus(table.id, 'occupied');
        await refreshOrders();

        const sentItems = insertedItems.map((it) => ({ ...it, status: 'sent' as const }));
        printComanda(latestOrder, sentItems, printers, settings.print_agent_url || '', {
          commercialName: settings.restaurant_name ?? '',
          legalName: settings.restaurant_legal_name ?? '',
          nif: settings.restaurant_nif ?? '',
          address: settings.restaurant_address ?? '',
          postalCode: settings.restaurant_postal_code ?? '',
          phone: settings.restaurant_phone ?? '',
          email: settings.restaurant_email ?? '',
        }).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al enviar comanda');
        setCart(snapshot);
      }
    })();

    setTimeout(() => setFlashSent(false), 900);
  }

  async function handlePrecuenta() {
    if (existingItems.length === 0 && cart.length === 0) return;
    setPrintingPrecuenta(true);
    setError(null);
    try {
      const order = await getOrCreateActiveOrder({
        table_id: table.id,
        table_name: table.name,
        waiter_id: waiter?.id ?? null,
        waiter_name: waiter?.name ?? null,
        covers,
        notes: orderNotes,
      });
      const oid = order.id;
      orderIdRef.current = oid;

      if (cart.length > 0) {
        await addItemsToOrder(oid, cart);
        await sendOrder(oid, table.id);
        await refreshOrders();
      }
      const items = await fetchOrderItems(oid);
      const { order: latestOrder } = await sendOrder(oid, table.id);

      await setTableStatus(table.id, 'requesting_bill');

      const result: PrecuentaPrintResult = await printPrecuenta(latestOrder, items, printers, settings.print_agent_url || '', {
        commercialName: settings.restaurant_name ?? '',
        legalName: settings.restaurant_legal_name ?? '',
        nif: settings.restaurant_nif ?? '',
        address: settings.restaurant_address ?? '',
        postalCode: settings.restaurant_postal_code ?? '',
        phone: settings.restaurant_phone ?? '',
        email: settings.restaurant_email ?? '',
      });

      if (!result.success && result.previewHtml) {
        setPrecuentaPreview(result.previewHtml);
      }
      setCart([]);
      await refreshOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al imprimir pre-cuenta');
    } finally {
      setPrintingPrecuenta(false);
    }
  }

  function doBrowserPrint() {
    const html = precuentaPreview;
    if (!html) return;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Pre-cuenta</title><style>body{margin:16px;font-family:'Courier New',monospace}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
    setPrecuentaPreview(null);
  }

  const displayName = formatTableName(table);

  return (
    <div className="flex flex-col h-screen">
      {/* === 1. CABECERA RESPONSIVE: mesa + camarero + total + botones superiores elevados === */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-2 -ml-1 rounded-lg hover:bg-stone-100 touch-tap shrink-0">
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-800 truncate leading-tight">{displayName}</h2>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {isAdmin ? (
                <select
                  value={selectedWaiter?.id ?? ''}
                  onChange={(e) => setSelectedWaiter(waiters.find((w) => w.id === e.target.value) ?? null)}
                  className="text-stone-600 bg-transparent border-0 focus:outline-none cursor-pointer"
                >
                  <option value="">Sin camarero</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium text-amber-700">{waiter?.name ?? '—'}</span>
              )}
              <span className="text-stone-300">·</span>
              <span className="font-bold text-emerald-700">{formatEUR(grandTotal)}</span>
              {orderId && <Badge color="amber">Abierta</Badge>}
              {table.status === 'requesting_bill' && <Badge color="orange">Cuenta</Badge>}
            </div>
          </div>
        </div>

        {/* Botones superiores organizados sin solapamiento */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
          {!isMergedChild && (
            <button
              onClick={() => setShowMerge(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 touch-tap"
              title="Unir mesas"
            >
              <Link2 className="w-4 h-4" />
              {mergedTables.length > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{mergedTables.length}</span>
              )}
            </button>
          )}
          {!isMergedChild && (
            <button
              onClick={() => setShowMoveTable(true)}
              disabled={existingItems.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 touch-tap disabled:opacity-40"
              title="Mover comanda a otra mesa"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handlePrecuenta}
            disabled={(existingItems.length === 0 && cart.length === 0) || printingPrecuenta}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 touch-tap disabled:opacity-40"
          >
            {printingPrecuenta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Pre-cuenta
          </button>
          {isAdmin && pendingTotal > 0 && onPay && (
            <button
              onClick={() => onPay(table)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 touch-tap"
            >
              Cobrar
            </button>
          )}
        </div>
      </div>

      {/* Network banner */}
      {blockedByNetwork && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Conéctate al Wi-Fi del restaurante para enviar comandas.
        </div>
      )}

      {/* Merge child banner */}
      {isMergedChild && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2 shrink-0">
          <Link2 className="w-4 h-4 shrink-0" />
          Esta mesa está unida a otra. Los pedidos se gestionan desde la mesa principal.
        </div>
      )}

      {/* === BODY: horizontal categories + subcategories + product grid (top) + ticket (bottom) === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Horizontal scrollable category bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll bg-stone-800 px-2 py-2 shrink-0 no-scrollbar">
          {sortedCats.map((c) => {
            const isActive = activeCat === c.id;
            const catCount = products.filter((p) => p.category_id === c.id && p.available).length;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  setSelectedDrinkSub('Todos');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all touch-tap shrink-0',
                  isActive ? cn(catColor(c).active, 'scale-105') : 'bg-stone-700 text-stone-300 hover:bg-stone-600',
                )}
              >
                <CategoryIcon name={c.icon_name} className="w-4 h-4 shrink-0" />
                {c.name}
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', isActive ? catColor(c).badge : 'bg-stone-600')}>{catCount}</span>
              </button>
            );
          })}
        </div>

        {/* Barra de subcategorías rápida exclusiva para Bebidas */}
        {isDrinksCategory && (
          <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll bg-amber-50 border-b border-amber-200 px-3 py-2 shrink-0 no-scrollbar">
            {DRINK_SUBCATEGORIES.map((sub) => {
              const isSubActive = selectedDrinkSub === sub;
              return (
                <button
                  key={sub}
                  onClick={() => setSelectedDrinkSub(sub)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all touch-tap shrink-0',
                    isSubActive
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-stone-700 border border-stone-200 hover:bg-amber-100',
                  )}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto touch-scroll bg-stone-50">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-stone-400 text-sm">
              No hay productos en esta selección.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
              {filteredProducts.map((p) => {
                const inCart = cart.filter((l) => l.product.id === p.id).reduce((s, l) => s + l.quantity, 0);
                const agotado = p.stock_actual <= 0;
                const lowStock = p.stock_actual > 0 && p.stock_actual <= 4;
                return (
                  <button
                    key={p.id}
                    onClick={() => openProductModal(p)}
                    disabled={blockedByNetwork || agotado}
                    className={cn(
                      'touch-tap relative rounded-xl border-2 bg-white p-2.5 text-left transition-all',
                      'hover:border-amber-400 active:scale-95',
                      inCart > 0 ? 'border-amber-400 ring-2 ring-amber-200' : 'border-stone-200',
                      agotado && 'opacity-40 border-red-200 bg-red-50 cursor-not-allowed',
                      lowStock && !agotado && 'border-orange-300',
                      blockedByNetwork && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                        {inCart}
                      </span>
                    )}
                    {agotado && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                        <Ban className="w-2 h-2" /> AGOTADO
                      </span>
                    )}
                    <div className={cn('font-semibold text-xs leading-snug', agotado ? 'text-stone-400 line-through' : 'text-stone-800')}>{p.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={cn('font-bold text-xs', agotado ? 'text-stone-400' : 'text-amber-700')}>{formatEUR(p.price)}</span>
                      {lowStock && !agotado && (
                        <span className="text-[9px] font-medium text-orange-600 bg-orange-100 px-1 py-0.5 rounded-full">{p.stock_actual}ud</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stacked bottom ticket panel */}
        <div className="border-t border-stone-300 bg-white shrink-0 flex flex-col max-h-[38vh]">
          <div className="px-3 py-2 border-b border-stone-200 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-bold text-stone-700 uppercase tracking-wide">Ticket · {displayName}</span>
            </div>
            {cartCount > 0 && (
              <span className="bg-amber-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>
            )}
          </div>
          <div className="overflow-y-auto touch-scroll px-2 py-1.5 flex-1">
            {existingItems.length === 0 && cart.length === 0 ? (
              <div className="text-center py-6 text-stone-400 text-xs">
                Selecciona productos para empezar.
              </div>
            ) : (
              <div className="space-y-1">
                {existingItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 border border-stone-200 bg-white text-xs">
                    <span className="font-bold text-amber-700 shrink-0 w-7 text-center">{it.quantity}×</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-stone-800 font-medium truncate">{it.product_name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {it.takeaway && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1 rounded">LLEVAR</span>}
                        {it.notes && <span className="text-[10px] italic text-amber-700 truncate">"{it.notes}"</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button onClick={() => openExistingNote(it)} className="text-[10px] text-stone-400 hover:text-amber-600 flex items-center gap-0.5">
                          <StickyNote className="w-2.5 h-2.5" /> Nota
                        </button>
                        {it.status === 'sent' && (
                          <button onClick={() => requestCancel(it)} className="text-[10px] text-stone-400 hover:text-red-600 flex items-center gap-0.5">
                            <Ban className="w-2.5 h-2.5" /> Anular
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-stone-400 text-[10px] w-14 text-right">{formatEUR(it.price)}</span>
                    <span className="shrink-0 font-semibold text-stone-700 w-14 text-right">{formatEUR(it.price * it.quantity)}</span>
                  </div>
                ))}

                {cart.length > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 bg-amber-300" />
                    <span className="text-[9px] font-bold text-amber-700 uppercase">Nueva</span>
                    <div className="h-px flex-1 bg-amber-300" />
                  </div>
                )}

                {cart.map((line, idx) => (
                  <div key={`cart-${idx}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 border border-amber-300 bg-amber-50 text-xs">
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => changeQty(idx, -1)} className="w-6 h-6 rounded bg-stone-200 text-stone-600 hover:bg-stone-300 touch-tap flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold w-5 text-center text-stone-800">{line.quantity}</span>
                      <button onClick={() => changeQty(idx, 1)} className="w-6 h-6 rounded bg-amber-200 text-amber-800 hover:bg-amber-300 touch-tap flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800 truncate">{line.product.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {line.takeaway && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1 rounded">LLEVAR</span>}
                        {line.notes && <span className="text-[10px] italic text-amber-700 truncate">"{line.notes}"</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button onClick={() => openNote(idx)} className="text-[10px] text-stone-400 hover:text-amber-600 flex items-center gap-0.5">
                          <StickyNote className="w-2.5 h-2.5" /> Nota
                        </button>
                        <button onClick={() => toggleTakeaway(idx)} className={cn('text-[10px] flex items-center gap-0.5', line.takeaway ? 'text-orange-600 font-semibold' : 'text-stone-400 hover:text-orange-600')}>
                          <Package className="w-2.5 h-2.5" /> Llevar
                        </button>
                        {isAdmin && (
                          <button onClick={() => removeLine(idx)} className="text-[10px] text-stone-400 hover:text-red-500 flex items-center gap-0.5">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-stone-400 text-[10px] w-14 text-right">{formatEUR(lineUnitPrice(line))}</span>
                    <span className="shrink-0 font-semibold text-amber-800 w-14 text-right">{formatEUR(lineUnitPrice(line) * line.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-stone-200 px-3 py-2 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-stone-500 text-xs">Total</span>
              <span className="text-lg font-bold text-stone-800">{formatEUR(grandTotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 flex items-center justify-center gap-1.5 !py-2.5"
                onClick={() => onPay?.(table)}
                disabled={(existingItems.length === 0 && cart.length === 0) || !onPay}
              >
                <Receipt className="w-4 h-4" />
                Cobrar
              </Button>
              <Button
                variant="primary"
                className="flex-1 flex items-center justify-center gap-2 !py-2.5"
                onClick={handleSend}
                disabled={cart.length === 0 || blockedByNetwork}
              >
                <Send className="w-4 h-4" />
                Enviar Comanda ({cartCount})
              </Button>
            </div>
            {error && <p className="text-red-600 text-[10px] text-center mt-1">{error}</p>}
          </div>
        </div>
      </div>

      {flashSent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-500/10 animate-fadeIn pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-3 animate-slideUp">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="font-bold text-stone-800 text-lg">Comanda enviada</p>
          </div>
        </div>
      )}

      {productModal && (
        <Modal open onClose={() => setProductModal(null)} title={productModal.product.name} size="sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Precio base</span>
              <span className="text-lg font-bold text-amber-700">{formatEUR(productModal.product.price)}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Cantidad</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setProductModal((m) => m ? { ...m, quantity: Math.max(1, m.quantity - 1) } : m)}
                  className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 touch-tap flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xl font-bold text-stone-800 w-8 text-center">{productModal.quantity}</span>
                <button
                  onClick={() => setProductModal((m) => m ? { ...m, quantity: m.quantity + 1 } : m)}
                  className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 touch-tap flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={() => setProductModal((m) => m ? { ...m, takeaway: !m.takeaway } : m)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all touch-tap',
                productModal.takeaway
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-stone-200 bg-white hover:border-orange-300',
              )}
            >
              <div className="flex items-center gap-2">
                <Package className={cn('w-5 h-5', productModal.takeaway ? 'text-orange-600' : 'text-stone-400')} />
                <span className={cn('text-sm font-medium', productModal.takeaway ? 'text-orange-700' : 'text-stone-600')}>Para llevar</span>
              </div>
              <span className={cn('text-sm font-bold', productModal.takeaway ? 'text-orange-600' : 'text-stone-400')}>+{formatEUR(TAKEAWAY_SUPPLEMENT)}</span>
            </button>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Nota de cocina</label>
              <input
                value={productModal.notes}
                onChange={(e) => setProductModal((m) => m ? { ...m, notes: e.target.value } : m)}
                placeholder="Ej. sin cebolla, muy hecho, bien cocido…"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {NOTE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setProductModal((m) => m ? { ...m, notes: m.notes ? `${m.notes}, ${s}` : s } : m)}
                    className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 hover:bg-amber-100 hover:text-amber-700 touch-tap"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <span className="text-sm text-stone-500">Total línea</span>
              <span className="text-lg font-bold text-stone-800">
                {formatEUR((productModal.product.price + (productModal.takeaway ? TAKEAWAY_SUPPLEMENT : 0)) * productModal.quantity)}
              </span>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setProductModal(null)}>Cancelar</Button>
              <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" onClick={addFromModal}>
                <Plus className="w-4 h-4" /> Añadir
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {precuentaPreview && (
        <Modal open onClose={() => setPrecuentaPreview(null)} title="Vista previa de Pre-cuenta" size="sm">
          <div className="bg-stone-50 rounded-xl border border-stone-200 p-3 max-h-[50vh] overflow-y-auto touch-scroll">
            <div dangerouslySetInnerHTML={{ __html: precuentaPreview }} />
          </div>
          <p className="text-xs text-stone-500 mt-2 text-center">
            No se pudo imprimir en red. Usa el botón para imprimir desde el navegador.
          </p>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" className="flex-1" onClick={() => setPrecuentaPreview(null)}>Cerrar</Button>
            <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" onClick={doBrowserPrint}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>
        </Modal>
      )}

      {showMerge && (
        <MergeModal
          table={table}
          tables={tables}
          mergedTables={mergedTables}
          busy={mergeBusy}
          error={mergeError}
          onClose={() => { setShowMerge(false); setMergeError(null); }}
          onMerge={async (secondary) => {
            setMergeBusy(true);
            setMergeError(null);
            try {
              await mergeTable(secondary.id, table.id);
              await refreshOrders();
              setMergeMsg(`Mesa ${secondary.name} unida a ${table.name}`);
              setTimeout(() => setMergeMsg(null), 2000);
            } catch (e) {
              setMergeError(e instanceof Error ? e.message : 'Error al unir mesa');
            } finally {
              setMergeBusy(false);
            }
          }}
          onUnmerge={async (secondaryId) => {
            setMergeBusy(true);
            setMergeError(null);
            try {
              await unmergeTable(secondaryId);
              await refreshOrders();
            } catch (e) {
              setMergeError(e instanceof Error ? e.message : 'Error al separar mesa');
            } finally {
              setMergeBusy(false);
            }
          }}
        />
      )}

      {mergeMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium animate-slideDown">
          {mergeMsg}
        </div>
      )}

      <Modal open={!!noteModal} onClose={() => setNoteModal(null)} title={`Nota: ${noteModal ? (noteModal.type === 'cart' ? noteModal.product.name : noteModal.productName) : ''}`} size="sm">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Ej. Poco hecho, sin cebolla, salsa aparte…"
          className="w-full border border-stone-300 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          {NOTE_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setNoteText((t) => (t ? `${t}, ${s}` : s))} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 hover:bg-amber-100 hover:text-amber-700 touch-tap">
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setNoteModal(null)}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={saveNote}>Guardar</Button>
        </div>
      </Modal>

      {cancelTarget && (
        <Modal open onClose={() => { setCancelTarget(null); setPinInput(''); setPinError(null); }} title="Anular plato enviado" size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-red-50 rounded-xl p-3">
              <ShieldAlert className="w-8 h-8 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Anular: {cancelTarget.quantity}× {cancelTarget.product_name}</p>
                <p className="text-xs text-red-600 mt-0.5">Se imprimirá un ticket de anulación en cocina.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">PIN de Admin</label>
              <input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter' && pinInput.length === 4) confirmCancel(); }}
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                className="w-full px-3 py-3 rounded-lg border border-stone-300 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
              {pinError && <p className="text-xs text-red-600 mt-1.5">{pinError}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setCancelTarget(null); setPinInput(''); setPinError(null); }}>Cancelar</Button>
              <Button variant="danger" className="flex-1 flex items-center justify-center gap-2" disabled={pinInput.length !== 4 || cancelBusy} onClick={confirmCancel}>
                {cancelBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Anular plato
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showMoveTable && (
        <Modal open onClose={() => setShowMoveTable(false)} title="Mover comanda a otra mesa" size="md">
          <p className="text-sm text-stone-600 mb-4">
            Traspasar la comanda completa de <strong>{table.name}</strong> a otra mesa libre. La mesa actual quedará libre.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto touch-scroll">
            {tables.filter((t) => t.id !== table.id && !t.merged_into && t.status === 'free').map((t) => (
              <button
                key={t.id}
                onClick={() => handleMoveTable(t)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 touch-tap"
              >
                <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-stone-800 text-sm">{t.name}</span>
                <span className="text-[10px] text-stone-500">{t.section}</span>
              </button>
            ))}
          </div>
          {tables.filter((t) => t.id !== table.id && !t.merged_into && t.status === 'free').length === 0 && (
            <p className="text-sm text-stone-400 italic text-center py-4">No hay mesas libres disponibles.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function MergeModal({
  table,
  tables,
  mergedTables,
  busy,
  error,
  onClose,
  onMerge,
  onUnmerge,
}: {
  table: RestaurantTable;
  tables: RestaurantTable[];
  mergedTables: RestaurantTable[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onMerge: (t: RestaurantTable) => void;
  onUnmerge: (id: string) => void;
}) {
  const available = tables.filter(
    (t) => t.id !== table.id && !t.merged_into && t.status === 'free',
  );

  return (
    <Modal open onClose={onClose} title="Unir mesas" size="md">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Las mesas unidas a <strong>{table.name}</strong> pasarán a estado ocupado y se gestionarán
          desde esta misma comanda. Al cobrar y liberar {table.name}, las mesas unidas se liberan
          automáticamente.
        </p>

        {mergedTables.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Mesas unidas a {table.name}
            </p>
            <div className="flex flex-wrap gap-2">
              {mergedTables.map((m) => (
                <div key={m.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Link2 className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-stone-800 text-sm">{m.name}</span>
                  <button
                    onClick={() => onUnmerge(m.id)}
                    disabled={busy}
                    className="ml-1 text-stone-400 hover:text-red-600 touch-tap disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {available.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Mesas libres disponibles
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {available.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onMerge(t)}
                  disabled={busy}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 touch-tap transition-colors disabled:opacity-40"
                >
                  <Link2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-stone-800 text-sm">{t.name}</span>
                  <span className="text-[10px] text-stone-500">{t.section}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic">No hay mesas libres para unir.</p>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}