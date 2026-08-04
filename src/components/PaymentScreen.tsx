import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Banknote, CreditCard, Check, Loader2, Receipt,
  ArrowLeft, AlertCircle, FileText, User,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, Ticket } from '@/lib/types';
import { Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import { fetchTableConsumption, payTable, type CustomerData } from '@/lib/api';
import { printFiscalTicket, type PrintResult } from '@/lib/print';
import { TicketView } from './TicketView';

const EMPTY_CUSTOMER: CustomerData = { name: '', nif: '', address: '', phone: '', email: '' };

interface TableEntry {
  table_id: string;
  table_name: string;
  orders: Order[];
  items: OrderItem[];
  subtotal: number;
  tax_total: number;
  total: number;
}

export function PaymentScreen({
  onBack,
  specificTable,
}: {
  onBack: () => void;
  specificTable?: { id: string; name: string } | null;
}) {
  const { settings, printers, reload } = useApp();
  const [tables, setTables] = useState<TableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TableEntry | null>(null);
  const [method, setMethod] = useState<'cash' | 'card' | null>(null);
  const [paying, setPaying] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printResults, setPrintResults] = useState<PrintResult[] | null>(null);

  const [cashInput, setCashInput] = useState('');
  const [isInvoice, setIsInvoice] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>(EMPTY_CUSTOMER);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['sent', 'open'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      const byTable = new Map<string, TableEntry>();
      for (const row of data ?? []) {
        const o = row as unknown as Order & { order_items: OrderItem[] };
        if (!o.table_id) continue;
        const activeItems = (o.order_items ?? []).filter(
          (it) => it.status !== 'cancelled' && it.status !== 'served',
        );
        const existing = byTable.get(o.table_id);
        if (existing) {
          existing.orders.push(o);
          existing.items.push(...activeItems);
        } else {
          byTable.set(o.table_id, {
            table_id: o.table_id,
            table_name: o.table_name ?? 'Mesa',
            orders: [o],
            items: activeItems,
            subtotal: 0,
            tax_total: 0,
            total: 0,
          });
        }
      }
      const entries = Array.from(byTable.values());
      for (const e of entries) {
        const total = e.items.reduce((s, it) => s + it.price * it.quantity, 0);
        const taxTotal = e.items.reduce((s, it) => {
          const base = (it.price * it.quantity) / (1 + it.iva_rate / 100);
          return s + (it.price * it.quantity) - base;
        }, 0);
        e.subtotal = total;
        e.tax_total = taxTotal;
        e.total = total;
      }
      entries.sort((a, b) => a.table_name.localeCompare(b.table_name));
      setTables(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  // Realtime: refresh table list when orders/items change
  useEffect(() => {
    const channel = supabase
      .channel('payment-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => loadTables())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTables]);

  useEffect(() => {
    if (specificTable && tables.length > 0 && !selected) {
      const match = tables.find((t) => t.table_id === specificTable.id);
      if (match) selectTable(match);
    }
  }, [specificTable, tables, selected]);

  async function selectTable(t: TableEntry) {
    const fresh = await fetchTableConsumption(t.table_id);
    const entry: TableEntry = {
      table_id: t.table_id,
      table_name: t.table_name,
      orders: fresh.orders,
      items: fresh.items,
      subtotal: fresh.subtotal,
      tax_total: fresh.tax_total,
      total: fresh.total,
    };
    setSelected(entry);
    setMethod(null);
    setError(null);
    setCashInput('');
    setIsInvoice(false);
    setCustomer(EMPTY_CUSTOMER);
  }

  const total = selected?.total ?? 0;
  const cashGiven = parseFloat(cashInput) || 0;
  const change = useMemo(() => Math.max(0, cashGiven - total), [cashGiven, total]);
  const invoiceValid = customer.name.trim() && customer.nif.trim();

  function pressDigit(d: string) {
    setCashInput((s) => {
      if (d === '.') { if (s.includes('.')) return s; if (s === '') return '0.'; return s + '.'; }
      if (s === '0') return d;
      if (s.includes('.') && s.split('.')[1].length >= 2) return s;
      return s + d;
    });
  }
  function backspace() { setCashInput((s) => s.slice(0, -1)); }
  function exactCash() { setCashInput(total.toFixed(2)); }
  function clearCash() { setCashInput(''); }

  async function handlePay() {
    if (!selected || !method) return;
    if (isInvoice && !invoiceValid) {
      setError('Completa nombre y NIF del cliente para emitir factura');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const chg = method === 'cash' ? Math.max(0, cashGiven - total) : 0;
      const t = await payTable(
        selected.table_id, method,
        method === 'cash' ? cashGiven : total, chg,
        settings,
        isInvoice ? customer : undefined,
      );
      setTicket(t);
      const results = await printFiscalTicket(
        t, selected.items, printers, t.qr_url ?? '', settings.print_agent_url || '',
      );
      setPrintResults(results);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en el cobro');
    } finally {
      setPaying(false);
    }
  }

  if (ticket) {
    return (
      <div className="max-w-md mx-auto p-4">
        <TicketView ticket={ticket} items={selected?.items ?? []} printResults={printResults} onClose={onBack} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-200 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-stone-100 touch-tap">
          <ArrowLeft className="w-5 h-5 text-stone-600" />
        </button>
        <h2 className="text-lg font-bold text-stone-800 flex-1">Cobro / Cierre de mesa</h2>
      </div>

      <div className="flex-1 overflow-y-auto touch-scroll p-4 max-w-3xl mx-auto w-full">
        {!selected ? (
          <>
            <p className="text-stone-500 text-sm mb-4">Selecciona una mesa con comanda para cobrar.</p>
            {loading ? (
              <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
            ) : tables.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-stone-300" />
                No hay mesas pendientes de cobro.
              </div>
            ) : (
              <div className="grid gap-2">
                {tables.map((t) => (
                  <button
                    key={t.table_id}
                    onClick={() => selectTable(t)}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-400 hover:shadow-sm transition-all touch-tap text-left"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-stone-800">{t.table_name}</div>
                      <div className="text-xs text-stone-500">
                        {t.orders.length} pedido{t.orders.length !== 1 ? 's' : ''} · {t.items.length} producto{t.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-amber-700">{formatEUR(t.total)}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            {/* Order summary — all items from ALL orders of this table */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-800">{selected.table_name}</h3>
                  <span className="text-xs text-stone-500">{selected.orders.length} pedido{selected.orders.length !== 1 ? 's' : ''} · {selected.items.length} productos</span>
                </div>
                <span className="text-2xl font-bold text-stone-800">{formatEUR(selected.total)}</span>
              </div>
              <div className="space-y-1 text-sm max-h-48 overflow-y-auto touch-scroll">
                {selected.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-stone-600">
                    <span>
                      {it.quantity}× {it.product_name}
                      {it.takeaway && <span className="text-[10px] font-bold text-orange-700 ml-1">Para llevar</span>}
                    </span>
                    <span>{formatEUR(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-100 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-stone-500">
                  <span>Base imponible</span><span>{formatEUR(selected.subtotal - selected.tax_total)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>IVA (10%)</span><span>{formatEUR(selected.tax_total)}</span>
                </div>
              </div>
            </div>

            {/* Method selection */}
            <p className="text-sm font-medium text-stone-600 mb-2">Forma de pago</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setMethod('cash'); setCashInput(selected.total.toFixed(2)); }}
                className={cn(
                  'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all touch-tap',
                  method === 'cash' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-stone-200 bg-white hover:border-emerald-300',
                )}
              >
                <Banknote className={cn('w-8 h-8', method === 'cash' ? 'text-emerald-600' : 'text-stone-400')} />
                <span className="font-medium text-stone-800">Efectivo</span>
              </button>
              <button
                onClick={() => setMethod('card')}
                className={cn(
                  'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all touch-tap',
                  method === 'card' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-stone-200 bg-white hover:border-blue-300',
                )}
              >
                <CreditCard className={cn('w-8 h-8', method === 'card' ? 'text-blue-600' : 'text-stone-400')} />
                <span className="font-medium text-stone-800">Tarjeta</span>
              </button>
            </div>

            {/* Numeric keypad for cash */}
            {method === 'cash' && (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 animate-slideUp">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-600">Importe entregado</span>
                  <span className="text-2xl font-bold text-stone-800">
                    {cashInput ? formatEUR(cashGiven) : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button key={d} onClick={() => pressDigit(d)} className="py-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-lg font-medium touch-tap active:scale-95">
                      {d}
                    </button>
                  ))}
                  <button onClick={() => pressDigit('.')} className="py-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-lg font-medium touch-tap active:scale-95">,</button>
                  <button onClick={() => pressDigit('0')} className="py-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-lg font-medium touch-tap active:scale-95">0</button>
                  <button onClick={backspace} className="py-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-lg font-medium touch-tap active:scale-95 flex items-center justify-center">
                    ⌫
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <Button variant="secondary" size="sm" onClick={exactCash} className="flex-1">Exacto</Button>
                  <Button variant="secondary" size="sm" onClick={clearCash} className="flex-1">Borrar</Button>
                </div>
                <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-3">
                  <span className="text-emerald-800 font-medium">Cambio a devolver</span>
                  <span className="text-2xl font-bold text-emerald-700">{formatEUR(change)}</span>
                </div>
              </div>
            )}

            {/* Card note */}
            {method === 'card' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 animate-slideUp">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Pago con datáfono</p>
                    <p>Al confirmar, se enviará el importe exacto al datáfono (Stripe Terminal / SumUp).
                    El camarero no necesita teclear el importe manualmente.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice option */}
            <button
              onClick={() => setIsInvoice((v) => !v)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all touch-tap mb-3',
                isInvoice ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white hover:border-amber-300',
              )}
            >
              <FileText className={cn('w-5 h-5', isInvoice ? 'text-amber-600' : 'text-stone-400')} />
              <span className="text-sm font-medium text-stone-700 flex-1 text-left">
                Emitir Factura Nominativa / Con Datos del Cliente
              </span>
              <div className={cn('w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all', isInvoice ? 'bg-amber-500 border-amber-500' : 'border-stone-300')}>
                {isInvoice && <Check className="w-4 h-4 text-white" />}
              </div>
            </button>

            {isInvoice && (
              <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 mb-4 animate-slideUp space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-1">
                  <User className="w-4 h-4" /> Datos del cliente
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Nombre o Razón Social *</label>
                  <input
                    value={customer.name}
                    onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    placeholder="Ej. Restaurante S.L. o Juan Pérez"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">NIF / CIF / DNI *</label>
                    <input
                      value={customer.nif}
                      onChange={(e) => setCustomer((c) => ({ ...c, nif: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      placeholder="B12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
                    <input
                      value={customer.phone}
                      onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      placeholder="666 123 456"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Dirección completa</label>
                  <input
                    value={customer.address}
                    onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    placeholder="Calle, número, ciudad, CP"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Correo electrónico</label>
                  <input
                    value={customer.email}
                    onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                    type="email"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    placeholder="cliente@email.com"
                  />
                </div>
                {isInvoice && !invoiceValid && (
                  <p className="text-xs text-amber-700">Nombre y NIF son obligatorios para emitir la factura.</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <Button
              variant="success"
              size="xl"
              className="w-full"
              onClick={handlePay}
              disabled={!method || paying || (method === 'cash' && cashGiven < total) || (isInvoice && !invoiceValid)}
            >
              {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {paying ? 'Procesando…' : `${isInvoice ? 'Emitir factura' : 'Cobrar'} ${formatEUR(total)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
