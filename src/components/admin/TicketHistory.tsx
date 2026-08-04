import { useEffect, useState, useCallback } from 'react';
import {
  Receipt, Ban, CheckCircle2, AlertCircle, Loader2, Printer,
  RefreshCw, Wallet, Banknote, CreditCard, X, Eye, Calendar, Search,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatEUR, formatDateTime } from '@/lib/format';
import { voidTicket, fetchOrderItems } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { printFiscalTicket } from '@/lib/print';
import type { Ticket, OrderItem } from '@/lib/types';
import { cn } from '@/lib/cn';

export function TicketHistory() {
  const { settings, printers, reload } = useApp();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [voiding, setVoiding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmTicket, setConfirmTicket] = useState<Ticket | null>(null);
  const [viewTicketModal, setViewTicketModal] = useState<{ ticket: Ticket; items: OrderItem[] } | null>(null);
  const [rectResult, setRectResult] = useState<{ rect: Ticket; originalNumber: string; items: OrderItem[] } | null>(null);
  const [printing, setPrinting] = useState(false);

  // Cargar tickets filtrados por fecha seleccionada
  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data, error: err } = await supabase
        .from('tickets')
        .select('*')
        .gte('ticket_datetime', startOfDay)
        .lte('ticket_datetime', endOfDay)
        .order('ticket_datetime', { ascending: false });

      if (err) throw err;
      setTickets(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Búsqueda global robusta en todo el ticket
  const filteredTickets = tickets.filter((t) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return JSON.stringify(t).toLowerCase().includes(term);
  });

  // Ver detalles y productos de un ticket pasado
  async function handleViewTicket(ticket: Ticket) {
    try {
      const items = ticket.order_id ? await fetchOrderItems(ticket.order_id) : [];
      setViewTicketModal({ ticket, items });
    } catch {
      setViewTicketModal({ ticket, items: [] });
    }
  }

  const isCash = (m?: string) => m === 'cash' || m === 'efectivo' || m?.toLowerCase() === 'efectivo';
  const isCard = (m?: string) => m === 'card' || m === 'tarjeta' || m?.toLowerCase() === 'tarjeta';

  const normalTickets = tickets.filter((t) => t.ticket_type === 'normal');
  const rectTickets = tickets.filter((t) => t.ticket_type === 'rectificativa');
  const voidedCount = normalTickets.filter((t) => t.voided).length;

  const grossTotal = normalTickets.reduce((s, t) => s + t.total, 0);
  const rectTotal = rectTickets.reduce((s, t) => s + t.total, 0);
  const netTotal = grossTotal + rectTotal;

  const cashGross = normalTickets.filter((t) => isCash(t.payment_method)).reduce((s, t) => s + t.total, 0);
  const cashRect = rectTickets.filter((t) => isCash(t.payment_method)).reduce((s, t) => s + t.total, 0);
  const cashNet = cashGross + cashRect;

  const cardGross = normalTickets.filter((t) => isCard(t.payment_method)).reduce((s, t) => s + t.total, 0);
  const cardRect = rectTickets.filter((t) => isCard(t.payment_method)).reduce((s, t) => s + t.total, 0);
  const cardNet = cardGross + cardRect;

  async function handleVoid(ticket: Ticket) {
    setVoiding(ticket.id);
    setError(null);
    setSuccess(null);
    try {
      // 1. Mandamos la orden a la base de datos
      await voidTicket(ticket.id, settings);
      
      // 2. Si todo va bien, mostramos éxito y recargamos la pantalla automáticamente
      setSuccess(`Ticket ${ticket.ticket_number} anulado con éxito.`);
      await loadTickets(); 
      await reload();
    } catch (e) {
      // 🛡️ ESCUDO DE SEGURIDAD: Si la interfaz choca al leer la respuesta, comprobamos la realidad
      const { data: check } = await supabase
        .from('tickets')
        .select('voided')
        .eq('id', ticket.id)
        .single();
        
      if (check?.voided) {
        // La base de datos hizo su trabajo perfecto. Ignoramos el error falso.
        setSuccess(`Ticket ${ticket.ticket_number} anulado con éxito.`);
        await loadTickets();
        await reload();
      } else {
        // Solo si la base de datos falló de verdad, mostramos el error
        setError(e instanceof Error ? e.message : 'Error al anular el ticket');
      }
    } finally {
      setVoiding(null);
      setConfirmTicket(null);
    }
  }

  async function handlePrintTicketCopy(ticket: Ticket, items: OrderItem[]) {
    setPrinting(true);
    try {
      await printFiscalTicket(ticket, items, printers, ticket.qr_url ?? '', settings.print_agent_url || '');
    } catch {
      // Impresión simulada
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-stone-800">Historial de Tickets / Ventas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-stone-300 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent focus:outline-none text-stone-700 font-medium"
            />
          </div>
          <button onClick={loadTickets} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-sm text-stone-700 touch-tap">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-stone-500 text-sm mb-4">Consulta de ventas por fecha, búsqueda global y gestión de copias o anulaciones.</p>

      {/* Buscador global */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar por nombre (ej. pepechupin), NIF o nº de ticket..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600">
            Limpiar
          </button>
        )}
      </div>

      {/* Arqueo de caja */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Arqueo de caja ({selectedDate})</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium mb-1">
              <Banknote className="w-3.5 h-3.5" /> Efectivo
            </div>
            <p className="text-xl font-bold text-emerald-800">{formatEUR(cashNet)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs font-medium mb-1">
              <CreditCard className="w-3.5 h-3.5" /> Tarjeta
            </div>
            <p className="text-xl font-bold text-blue-800">{formatEUR(cardNet)}</p>
          </div>
          <div className="bg-stone-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-stone-600 text-xs font-medium mb-1">
              <Receipt className="w-3.5 h-3.5" /> Tickets
            </div>
            <p className="text-xl font-bold text-stone-800">{normalTickets.length - voidedCount} válidos</p>
            {voidedCount > 0 && <p className="text-xs text-red-500">{voidedCount} anulado(s)</p>}
          </div>
          <div className={cn('rounded-xl p-3', netTotal >= 0 ? 'bg-amber-50' : 'bg-red-50')}>
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium mb-1">
              <Wallet className="w-3.5 h-3.5" /> Total neto
            </div>
            <p className={cn('text-xl font-bold', netTotal >= 0 ? 'text-amber-800' : 'text-red-800')}>{formatEUR(netTotal)}</p>
          </div>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Lista de tickets */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : filteredTickets.length === 0 ? (
        <EmptyState icon={<Receipt className="w-12 h-12" />} title="No se encontraron tickets" subtitle="Prueba a cambiar la fecha o el término de búsqueda." />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 text-xs uppercase text-stone-500 font-medium grid grid-cols-12 gap-2">
            <span className="col-span-4 sm:col-span-3">Nº Ticket / Cliente</span>
            <span className="col-span-2 hidden sm:block">Hora</span>
            <span className="col-span-3 sm:col-span-2">Pago</span>
            <span className="col-span-2 sm:col-span-2 text-right">Importe</span>
            <span className="col-span-3 sm:col-span-3 text-right">Acciones</span>
          </div>
          <div className="divide-y divide-stone-100">
            {filteredTickets.map((t: any) => {
              const isRect = t.ticket_type === 'rectificativa';
              const isVoided = t.voided;
              return (
                <div
                  key={t.id}
                  className={cn(
                    'px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm transition-colors',
                    isRect ? 'bg-red-50/50' : isVoided ? 'bg-stone-50 opacity-60' : 'hover:bg-stone-50',
                  )}
                >
                  <div className="col-span-4 sm:col-span-3">
                    <p className={cn('font-mono font-medium truncate', isRect ? 'text-red-700' : 'text-stone-800')}>
                      {t.ticket_number}
                    </p>
                    {t.customer_name && (
                      <p className="text-xs font-semibold text-amber-700 truncate">{t.customer_name}</p>
                    )}
                    {isRect && <Badge color="red">Rectificativa</Badge>}
                    {isVoided && <Badge color="stone">Anulado</Badge>}
                  </div>
                  <span className="col-span-2 hidden sm:block text-stone-500">{formatDateTime(t.ticket_datetime)}</span>
                  <div className="col-span-3 sm:col-span-2">
                    {t.payment_method && (
                      <Badge color={isCash(t.payment_method) ? 'emerald' : 'blue'}>
                        {isCash(t.payment_method) ? 'Efectivo' : 'Tarjeta'}
                      </Badge>
                    )}
                  </div>
                  <span className={cn('col-span-2 sm:col-span-2 text-right font-semibold truncate', isRect || isVoided ? 'text-red-600' : 'text-stone-800')}>
                    {formatEUR(t.total)}
                  </span>
                  <div className="col-span-3 sm:col-span-3 flex justify-end gap-1.5">
                    <button
                      onClick={() => handleViewTicket(t)}
                      className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 touch-tap"
                      title="Ver detalle y productos"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!isRect && !isVoided && (
                      <button
                        onClick={() => setConfirmTicket(t)}
                        disabled={voiding === t.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium touch-tap disabled:opacity-50"
                      >
                        {voiding === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                        Anular
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal detalle y reimpresión */}
      {viewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewTicketModal(null)}>
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div>
                <h3 className="font-bold text-stone-800">Detalle del Ticket</h3>
                <p className="text-xs font-mono text-stone-500">{viewTicketModal.ticket.ticket_number}</p>
                {(viewTicketModal.ticket as any).customer_name && (
                  <p className="text-xs font-medium text-amber-700 mt-0.5">Cliente: {(viewTicketModal.ticket as any).customer_name} (NIF: {(viewTicketModal.ticket as any).customer_nif})</p>
                )}
              </div>
              <button onClick={() => setViewTicketModal(null)} className="p-1 rounded-lg hover:bg-stone-100">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="space-y-2 mb-6 font-mono text-sm">
              <div className="text-xs text-stone-500 mb-2">Fecha: {formatDateTime(viewTicketModal.ticket.ticket_datetime)}</div>
              <div className="border-t border-dashed border-stone-300 my-2" />
              {viewTicketModal.items.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No hay productos registrados para este ticket.</p>
              ) : (
                viewTicketModal.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-stone-700">
                    <span>{it.quantity}× {it.product_name}</span>
                    <span>{formatEUR(it.price * it.quantity)}</span>
                  </div>
                ))
              )}
              <div className="border-t border-dashed border-stone-300 my-2" />
              <div className="flex justify-between font-bold text-base text-stone-900">
                <span>TOTAL</span>
                <span>{formatEUR(viewTicketModal.ticket.total)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setViewTicketModal(null)}>Cerrar</Button>
              <Button
                variant="primary"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={() => handlePrintTicketCopy(viewTicketModal.ticket, viewTicketModal.items)}
                disabled={printing}
              >
                {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Imprimir copia
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de confirmación de anulación */}
      {confirmTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmTicket(null)}>
          <Card className="w-full max-w-md p-6" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-stone-800">Anular ticket</h3>
                <p className="text-stone-500 text-sm">Se generará una factura rectificativa</p>
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-stone-500">Ticket:</span><span className="font-mono font-medium">{confirmTicket.ticket_number}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Importe:</span><span className="font-semibold">{formatEUR(confirmTicket.total)}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmTicket(null)}>Cancelar</Button>
              <Button variant="primary" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleVoid(confirmTicket)}>
                {voiding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Confirmar anulación
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}