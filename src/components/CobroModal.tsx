import { useState, useEffect, useMemo } from 'react';
import {
  Banknote, CreditCard, Check, Loader2, Receipt, AlertCircle,
  FileText, User, Search,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { OrderItem, Ticket, Customer } from '@/lib/types';
import { Button, Modal, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import { fetchTableConsumption, payTable, searchCustomers, saveCustomer, type CustomerData } from '@/lib/api';
import { printFiscalTicket, type PrintResult } from '@/lib/print';
import { TicketView } from './TicketView';

const EMPTY_CUSTOMER: CustomerData = { name: '', nif: '', address: '', phone: '', email: '', customer_id: null };

export function CobroModal({
  table,
  onClose,
}: {
  table: { id: string; name: string };
  onClose: () => void;
}) {
  const { settings, printers, reload } = useApp();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [totals, setTotals] = useState({ subtotal: 0, tax_total: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<'cash' | 'card' | null>(null);
  const [paying, setPaying] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printResults, setPrintResults] = useState<PrintResult[] | null>(null);

  const [cashInput, setCashInput] = useState('');
  const [isInvoice, setIsInvoice] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>(EMPTY_CUSTOMER);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const consumption = await fetchTableConsumption(table.id);
        if (cancelled) return;
        setItems(consumption.items);
        setTotals({ subtotal: consumption.subtotal, tax_total: consumption.tax_total, total: consumption.total });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [table.id]);

  const total = totals.total;
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
    if (!method) return;
    if (isInvoice && !invoiceValid) {
      setError('Completa nombre y NIF del cliente para emitir factura');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      let payCustomer = isInvoice ? { ...customer } : undefined;
      if (isInvoice && payCustomer && !payCustomer.customer_id && payCustomer.nif) {
        const saved = await saveCustomer(payCustomer);
        payCustomer = { ...payCustomer, customer_id: saved.id };
      }
      const chg = method === 'cash' ? Math.max(0, cashGiven - total) : 0;
      const t = await payTable(
        table.id, method,
        method === 'cash' ? cashGiven : total, chg,
        settings,
        payCustomer,
      );
      setTicket(t);
      const results = await printFiscalTicket(t, items, printers, t.qr_url ?? '', settings.print_agent_url || '');
      setPrintResults(results);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en el cobro');
    } finally {
      setPaying(false);
    }
  }

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchCustomers(q);
      setSearchResults(results);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectCustomer(c: Customer) {
    setCustomer({
      customer_id: c.id,
      name: c.name,
      nif: c.tax_id ?? '',
      address: c.address ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  }

  function clearCustomer() {
    setCustomer(EMPTY_CUSTOMER);
    setSearchQuery('');
    setSearchResults([]);
  }

  if (ticket) {
    return (
      <Modal open onClose={onClose} title="Ticket de cobro" size="md">
        <TicketView ticket={ticket} items={items} printResults={printResults} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Cobro · ${table.name}`} size="md">
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-stone-400">
          <Receipt className="w-12 h-12 mx-auto mb-2 text-stone-300" />
          <p>No hay consumos pendientes en esta mesa.</p>
          <Button variant="secondary" className="mt-4" onClick={onClose}>Cerrar</Button>
        </div>
      ) : (
        <div>
          {/* Product breakdown */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-stone-800">{table.name}</h3>
              <span className="text-2xl font-bold text-stone-800">{formatEUR(total)}</span>
            </div>
            <div className="space-y-1.5 text-sm max-h-44 overflow-y-auto touch-scroll">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-stone-600">
                  <span>
                    {it.quantity}× {it.product_name}
                    {it.takeaway && <span className="text-[10px] font-bold text-orange-700 ml-1">Para llevar</span>}
                  </span>
                  <span className="font-medium">{formatEUR(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>Base imponible</span><span>{formatEUR(totals.subtotal - totals.tax_total)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>IVA (10%)</span><span>{formatEUR(totals.tax_total)}</span>
              </div>
              <div className="flex justify-between font-bold text-stone-800 pt-1">
                <span>Total a pagar</span><span>{formatEUR(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <p className="text-sm font-medium text-stone-600 mb-2">Forma de pago</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => { setMethod('cash'); setCashInput(total.toFixed(2)); }}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all touch-tap',
                method === 'cash' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-stone-200 bg-white hover:border-emerald-300',
              )}
            >
              <Banknote className={cn('w-7 h-7', method === 'cash' ? 'text-emerald-600' : 'text-stone-400')} />
              <span className="font-medium text-stone-800 text-sm">Efectivo</span>
            </button>
            <button
              onClick={() => setMethod('card')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all touch-tap',
                method === 'card' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-stone-200 bg-white hover:border-blue-300',
              )}
            >
              <CreditCard className={cn('w-7 h-7', method === 'card' ? 'text-blue-600' : 'text-stone-400')} />
              <span className="font-medium text-stone-800 text-sm">Tarjeta</span>
            </button>
          </div>

          {/* Numeric keypad for cash */}
          {method === 'cash' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-3 mb-4 animate-slideUp">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-stone-600">Importe entregado</span>
                <span className="text-2xl font-bold text-stone-800">
                  {cashInput ? formatEUR(cashGiven) : '—'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
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
                <span className="text-emerald-800 font-medium text-sm">Cambio a devolver</span>
                <span className="text-2xl font-bold text-emerald-700">{formatEUR(change)}</span>
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
            <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-3 mb-4 animate-slideUp space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <User className="w-4 h-4" /> Datos del cliente
                </div>
                {customer.customer_id && (
                  <button onClick={clearCustomer} className="text-xs text-stone-500 hover:text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Limpiar cliente
                  </button>
                )}
              </div>

              {/* Buscador por NIF o Nombre */}
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-white focus-within:ring-2 focus-within:ring-amber-400/50">
                  <Search className="w-4 h-4 text-stone-400 shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(e) => doSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    className="flex-1 text-sm border-0 outline-none bg-transparent"
                    placeholder="Buscar por NIF o nombre…"
                  />
                  {searching && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
                </div>
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-stone-200 shadow-lg max-h-48 overflow-y-auto touch-scroll">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 text-left touch-tap border-b border-stone-100 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-stone-800 truncate">{c.name}</div>
                          <div className="text-xs text-stone-500">{c.tax_id ?? 'Sin NIF'}{c.city ? ` · ${c.city}` : ''}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-stone-200 shadow-lg px-3 py-2.5 text-sm text-stone-500">
                    No se encontraron clientes. Rellena los datos para crear uno nuevo.
                  </div>
                )}
              </div>

              {customer.customer_id && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5">
                  <Check className="w-3.5 h-3.5" /> Cliente registrado — datos cargados
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre o Razón Social *</label>
                <input
                  value={customer.name}
                  onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value, customer_id: null }))}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  placeholder="Ej. Restaurante S.L. o Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">NIF / CIF / DNI *</label>
                  <input
                    value={customer.nif}
                    onChange={(e) => setCustomer((c) => ({ ...c, nif: e.target.value.toUpperCase(), customer_id: null }))}
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
              {!customer.customer_id && customer.nif && invoiceValid && (
                <p className="text-xs text-stone-500">Se guardará como nuevo cliente al emitir la factura.</p>
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
            size="lg"
            className="w-full"
            onClick={handlePay}
            disabled={!method || paying || (method === 'cash' && cashGiven < total) || (isInvoice && !invoiceValid)}
          >
            {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {paying ? 'Procesando…' : `${isInvoice ? 'Emitir factura' : 'Cobrar'} ${formatEUR(total)}`}
          </Button>
        </div>
      )}
    </Modal>
  );
}
