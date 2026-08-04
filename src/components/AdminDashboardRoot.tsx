import { useState } from 'react';
import {
  LayoutDashboard, UtensilsCrossed, Grid3x3, Printer, ShieldCheck,
  Receipt, LogOut, Flame, Users, Boxes, Store, History, Wallet, CalendarCheck, BarChart3,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/cn';
import { AdminDashboard } from './admin/AdminDashboard';
import { ProductManager } from './admin/ProductManager';
import { TableMap } from './admin/TableMap';
import { PrinterConfig } from './admin/PrinterConfig';
import { FiscalSettings } from './admin/FiscalSettings';
import { FiscalRegistry } from './admin/FiscalRegistry';
import { WaiterManager } from './admin/WaiterManager';
import { Inventory } from './admin/Inventory';
import { LocalSettings } from './admin/LocalSettings';
import { TicketHistory } from './admin/TicketHistory';
import { Caja } from './admin/Caja';
import { Reservas } from './admin/Reservas';
import { Reports } from './admin/Reports';
import { OrderScreen } from './OrderScreen';
import { CobroModal } from './CobroModal';
import type { RestaurantTable } from '@/lib/types';

type AdminTab = 'dashboard' | 'products' | 'waiters' | 'inventory' | 'local' | 'history' | 'tables' | 'printers' | 'fiscal' | 'registry' | 'caja' | 'reservas' | 'reports';

export function AdminDashboardRoot() {
  const { logout, settings } = useApp();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [managingTable, setManagingTable] = useState<RestaurantTable | null>(null);
  const [payingTable, setPayingTable] = useState<RestaurantTable | null>(null);

  const tabs: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'caja', label: 'Caja', icon: Wallet },
    { id: 'tables', label: 'Mesas', icon: Grid3x3 },
    { id: 'reservas', label: 'Reservas', icon: CalendarCheck },
    { id: 'products', label: 'Productos', icon: UtensilsCrossed },
    { id: 'waiters', label: 'Camareros', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: Boxes },
    { id: 'reports', label: 'Informes', icon: BarChart3 },
    { id: 'local', label: 'Datos del Local', icon: Store },
    { id: 'printers', label: 'Impresoras', icon: Printer },
    { id: 'fiscal', label: 'Veri*Factu', icon: ShieldCheck },
    { id: 'history', label: 'Historial', icon: History },
    { id: 'registry', label: 'Registro fiscal', icon: Receipt },
  ];

  if (managingTable) {
    return (
      <OrderScreen
        table={managingTable}
        role="admin"
        onBack={() => setManagingTable(null)}
        onPay={(t) => { setManagingTable(null); setPayingTable(t); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 bg-stone-800 text-stone-300 flex lg:flex-col flex-row items-center lg:items-stretch shrink-0 lg:min-h-screen overflow-x-auto lg:overflow-y-auto">
        <div className="hidden lg:flex items-center gap-2.5 px-5 py-5 border-b border-stone-700">
          <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">{settings.restaurant_name || 'La Parrilla'}</p>
            <p className="text-stone-400 text-xs">Admin / Caja</p>
          </div>
        </div>

        <nav className="flex lg:flex-col flex-row gap-1 p-2 lg:p-3 flex-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 lg:px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap touch-tap',
                  tab === t.id ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-400 hover:bg-stone-700 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block p-3 border-t border-stone-700">
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-stone-400 hover:bg-stone-700 hover:text-white w-full touch-tap">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
        <button onClick={logout} className="lg:hidden p-3 text-stone-400">
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto touch-scroll">
        {tab === 'dashboard' && <AdminDashboard onNavigate={setTab} />}
        {tab === 'caja' && <Caja />}
        {tab === 'reservas' && <Reservas />}
        {tab === 'reports' && <Reports />}
        {tab === 'products' && <ProductManager />}
        {tab === 'waiters' && <WaiterManager />}
        {tab === 'inventory' && <Inventory />}
        {tab === 'local' && <LocalSettings />}
        {tab === 'history' && <TicketHistory />}
        {tab === 'tables' && <TableMap onPay={(t) => setPayingTable(t)} onManage={(t) => setManagingTable(t)} />}
        {tab === 'printers' && <PrinterConfig />}
        {tab === 'fiscal' && <FiscalSettings onNavigateLocal={() => setTab('local')} />}
        {tab === 'registry' && <FiscalRegistry />}
      </div>

      {/* Cobro modal — opens when admin clicks "Cobrar" on a table */}
      {payingTable && (
        <CobroModal table={payingTable} onClose={() => setPayingTable(null)} />
      )}
    </div>
  );
}
