import { useEffect, useState, useCallback } from 'react';
import {
  Receipt, ShoppingBag, Banknote, TrendingUp, ArrowRight, Wallet, ClipboardList,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR, formatDateTime } from '@/lib/format';
import { fetchTickets } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Ticket } from '@/lib/types';

export function AdminDashboard({ onNavigate }: { onNavigate: (t: 'dashboard' | 'products' | 'waiters' | 'inventory' | 'local' | 'history' | 'tables' | 'printers' | 'fiscal' | 'registry') => void }) {
  const { tables, products, settings, tableOrders } = useApp();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(() => {
    fetchTickets(50)
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Realtime: refresh ticket totals instantly when a payment is registered
  useEffect(() => {
    const channel = supabase
      .channel('admin-tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTickets]);

  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const free = tables.filter((t) => t.status === 'free').length;
  const today = new Date().toDateString();
  const todayTickets = tickets.filter((t) => new Date(t.ticket_datetime).toDateString() === today);
  const activeTickets = todayTickets.filter((t) => t.ticket_type === 'normal' && !t.voided);
  const todayTotal = todayTickets.reduce((s, t) => s + t.total, 0);
  const cashTotal = todayTickets.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0);
  const cardTotal = todayTickets.filter((t) => t.payment_method === 'card').reduce((s, t) => s + t.total, 0);
  const voidedCount = todayTickets.filter((t) => t.voided).length;

  // Comandas activas (open + sent) — actualizadas en tiempo real via AppContext
  const activeOrders = Object.values(tableOrders);
  const sentOrders = activeOrders.filter((o) => o.status === 'sent');
  const openOrders = activeOrders.filter((o) => o.status === 'open');
  const pendingTotal = activeOrders.reduce((s, o) => s + o.total, 0);

  const stats = [
    { label: 'Ventas hoy', value: formatEUR(todayTotal), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Pendiente cobro', value: formatEUR(pendingTotal), icon: ClipboardList, color: 'text-orange-600 bg-orange-100' },
    { label: 'Mesas ocupadas', value: `${occupied} / ${tables.length}`, icon: ShoppingBag, color: 'text-amber-600 bg-amber-100' },
    { label: 'Efectivo', value: formatEUR(cashTotal), icon: Wallet, color: 'text-blue-600 bg-blue-100' },
  ];

  const quickLinks: { label: string; tab: 'products' | 'waiters' | 'inventory' | 'local' | 'history' | 'tables' | 'printers' | 'fiscal'; icon: typeof ShoppingBag }[] = [
    { label: 'Gestionar productos', tab: 'products', icon: ShoppingBag },
    { label: 'Camareros / Personal', tab: 'waiters', icon: Receipt },
    { label: 'Inventario', tab: 'inventory', icon: Receipt },
    { label: 'Datos del Local', tab: 'local', icon: Receipt },
    { label: 'Historial de Tickets', tab: 'history', icon: Receipt },
    { label: 'Mapa de mesas', tab: 'tables', icon: ShoppingBag },
    { label: 'Configurar impresoras', tab: 'printers', icon: Receipt },
    { label: 'Ajustes Veri*Factu', tab: 'fiscal', icon: Receipt },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-1">Panel de control</h1>
      <p className="text-stone-500 text-sm mb-6">Resumen de la actividad del restaurante.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-stone-800">{s.value}</p>
              <p className="text-stone-500 text-sm">{s.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-800">Comandas activas</h3>
            <Badge color="amber">{sentOrders.length} enviadas · {openOrders.length} abiertas</Badge>
          </div>
          {activeOrders.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-4">No hay comandas activas.</p>
          ) : (
            <div className="space-y-1.5">
              {activeOrders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center gap-3 py-1.5 border-b border-stone-100 last:border-0 text-sm">
                  <span className="font-medium text-stone-700">{o.table_name ?? 'Sin mesa'}</span>
                  <Badge color={o.status === 'sent' ? 'amber' : 'blue'}>
                    {o.status === 'sent' ? 'Enviada' : 'Abierta'}
                  </Badge>
                  {o.waiter_name && <span className="text-xs text-stone-400">· {o.waiter_name}</span>}
                  <span className="ml-auto font-semibold text-stone-800">{formatEUR(o.total)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-stone-600">Total pendiente de cobro</span>
                <span className="text-lg font-bold text-orange-700">{formatEUR(pendingTotal)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-800">Estado de mesas</h3>
            <Badge color="emerald">{free} libres</Badge>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className={`text-center py-2 rounded-lg text-xs font-medium ${
                  t.status === 'occupied' ? 'bg-amber-100 text-amber-800' :
                  t.status === 'reserved' ? 'bg-blue-100 text-blue-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}
              >
                {t.name.replace('Mesa ', '').replace('Terraza ', 'T').replace('Barra ', 'B')}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-stone-800 mb-3">Desglose de cobros hoy</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-stone-600"><Banknote className="w-4 h-4 text-emerald-600" /> Efectivo</span>
              <span className="font-semibold">{formatEUR(cashTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-stone-600"><Receipt className="w-4 h-4 text-blue-600" /> Tarjeta</span>
              <span className="font-semibold">{formatEUR(cardTotal)}</span>
            </div>
            <div className="border-t border-stone-100 pt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700">Total</span>
              <span className="text-lg font-bold text-stone-800">{formatEUR(todayTotal)}</span>
            </div>
            {voidedCount > 0 && (
              <div className="flex items-center justify-between text-xs text-red-600">
                <span>Anulaciones / Rectificativas</span>
                <span>{voidedCount} ticket(s) anulado(s)</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-stone-800 mb-3">Accesos rápidos</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.tab}
                onClick={() => onNavigate(q.tab)}
                className="flex items-center gap-2 p-3 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50 transition-all touch-tap text-sm text-stone-700"
              >
                <Icon className="w-4 h-4 text-amber-600" />
                <span className="flex-1 text-left">{q.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-stone-800 mb-3">Últimos tickets fiscales</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>
        ) : todayTickets.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">No hay tickets hoy todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {todayTickets.slice(0, 8).map((t) => (
              <div key={t.id} className={cn("flex items-center gap-3 py-2 border-b border-stone-100 last:border-0 text-sm", (t.voided || t.ticket_type === 'rectificativa') && 'opacity-60')}>
                <span className={cn("font-mono text-xs", t.ticket_type === 'rectificativa' ? 'text-red-500' : 'text-stone-500')}>{t.ticket_number}</span>
                <span className="text-stone-600">{formatDateTime(t.ticket_datetime)}</span>
                <Badge color={t.payment_method === 'cash' ? 'emerald' : 'blue'}>
                  {t.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                </Badge>
                {(t.voided || t.ticket_type === 'rectificativa') && <Badge color="red">{t.ticket_type === 'rectificativa' ? 'Rect.' : 'Anulado'}</Badge>}
                <span className={cn("ml-auto font-semibold", t.ticket_type === 'rectificativa' ? 'text-red-600' : 'text-stone-800')}>{formatEUR(t.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-stone-400 mt-6 text-center">
        Modo Veri*Factu: <span className="font-medium">{settings.verifactu_mode ?? 'SANDBOX'}</span>
        {settings.verifactu_mode === 'LIVE' && ' · Certificado cargado'}
      </p>
    </div>
  );
}
