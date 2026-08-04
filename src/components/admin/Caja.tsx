import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Plus, Trash2, Lock, Unlock, Loader2, TrendingUp, TrendingDown,
  Calculator, ArrowDownToLine, ArrowUpFromLine, Calendar,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Card, Modal, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR, formatDate } from '@/lib/format';
import {
  fetchTodayCashSession, openCashSession, closeCashSession,
  fetchCashMovements, addCashMovement, deleteCashMovement,
  fetchCashSessions, fetchTickets,
} from '@/lib/api';
import type { CashSession, CashMovement, Ticket } from '@/lib/types';

export function Caja() {
  const { waiter, reload } = useApp();
  const [session, setSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [todayTickets, setTodayTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, tickets] = await Promise.all([
        fetchTodayCashSession(),
        fetchTickets(100),
      ]);
      setSession(s);
      const today = new Date().toDateString();
      setTodayTickets(tickets.filter((t) => new Date(t.ticket_datetime).toDateString() === today));
      if (s) {
        const m = await fetchCashMovements(s.id);
        setMovements(m);
      }
    } catch (e) {
      console.error('Caja load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cashSales = todayTickets.filter((t) => t.payment_method === 'cash' && !t.voided && t.ticket_type === 'normal')
    .reduce((s, t) => s + t.total, 0);
  const totalSales = todayTickets.filter((t) => !t.voided && t.ticket_type === 'normal')
    .reduce((s, t) => s + t.total, 0);
  const cardSales = totalSales - cashSales;
  const exitsTotal = movements.filter((m) => m.type === 'exit').reduce((s, m) => s + m.amount, 0);
  const entriesTotal = movements.filter((m) => m.type === 'entry').reduce((s, m) => s + m.amount, 0);
  const expectedCash = (session?.opening_amount ?? 0) + cashSales - exitsTotal + entriesTotal;

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  }

  if (!session) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Caja</h1>
        <p className="text-stone-500 text-sm mb-6">No hay caja abierta hoy. Registra el fondo inicial para empezar.</p>
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-stone-800 mb-2">Caja cerrada</h3>
          <p className="text-stone-500 text-sm mb-6">Abre la caja registrando el fondo inicial (cambio) disponible en el cajón.</p>
          <Button variant="primary" className="flex items-center gap-2 mx-auto" onClick={() => setShowOpenModal(true)}>
            <Unlock className="w-5 h-5" /> Abrir caja
          </Button>
        </Card>
        {showOpenModal && (
          <OpenCashModal
            onClose={() => setShowOpenModal(false)}
            onOpen={async (amount) => {
              await openCashSession(amount, waiter?.name ?? 'Admin');
              await load();
              setShowOpenModal(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Caja</h1>
          <p className="text-stone-500 text-sm">Sesión abierta · {formatDate(session.session_date)} · {session.opened_by}</p>
        </div>
        <Badge color="emerald">Abierta</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-stone-500 text-sm"><Wallet className="w-4 h-4" /> Fondo inicial</div>
          <p className="text-xl font-bold text-stone-800">{formatEUR(session.opening_amount)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-emerald-600 text-sm"><TrendingUp className="w-4 h-4" /> Ventas efectivo</div>
          <p className="text-xl font-bold text-emerald-700">{formatEUR(cashSales)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-orange-600 text-sm"><TrendingDown className="w-4 h-4" /> Salidas</div>
          <p className="text-xl font-bold text-orange-700">{formatEUR(exitsTotal)}</p>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 mb-2 text-amber-700 text-sm"><Calculator className="w-4 h-4" /> Efectivo esperado</div>
          <p className="text-xl font-bold text-amber-800">{formatEUR(expectedCash)}</p>
        </Card>
      </div>

      {/* Cash movements */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-stone-800">Salidas / Entradas de efectivo</h3>
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5" onClick={() => setShowMovementModal(true)}>
            <Plus className="w-4 h-4" /> Añadir
          </Button>
        </div>
        {movements.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-4">No hay movimientos registrados.</p>
        ) : (
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0 text-sm">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  m.type === 'exit' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')}>
                  {m.type === 'exit' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-stone-800 block truncate">{m.reason}</span>
                  <span className="text-xs text-stone-400">{m.created_by ?? '—'} · {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <span className={cn('font-semibold shrink-0', m.type === 'exit' ? 'text-orange-700' : 'text-emerald-700')}>
                  {m.type === 'exit' ? '−' : '+'}{formatEUR(m.amount)}
                </span>
                <button onClick={() => deleteCashMovement(m.id).then(load)} className="text-stone-300 hover:text-red-500 touch-tap shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payment breakdown */}
      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-stone-800 mb-4">Desglose de cobros del día</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-stone-500 text-sm mb-1">Efectivo</p>
            <p className="text-xl font-bold text-emerald-700">{formatEUR(cashSales)}</p>
          </div>
          <div className="text-center">
            <p className="text-stone-500 text-sm mb-1">Tarjeta</p>
            <p className="text-xl font-bold text-blue-700">{formatEUR(cardSales)}</p>
          </div>
          <div className="text-center border-l border-stone-200 pl-4">
            <p className="text-stone-500 text-sm mb-1">Total</p>
            <p className="text-xl font-bold text-stone-800">{formatEUR(totalSales)}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex items-center gap-2" onClick={async () => {
          const h = await fetchCashSessions(90);
          setHistory(h);
          setShowHistory(true);
        }}>
          <Calendar className="w-4 h-4" /> Historial
        </Button>
        <Button variant="danger" className="flex-1 flex items-center justify-center gap-2" onClick={() => setShowCloseModal(true)}>
          <Lock className="w-5 h-5" /> Cierre Z · Cerrar caja
        </Button>
      </div>

      {/* Modals */}
      {showMovementModal && (
        <MovementModal
          onClose={() => setShowMovementModal(false)}
          onAdd={async (amount, reason, type) => {
            await addCashMovement(session.id, amount, reason, type, waiter?.name ?? 'Admin');
            await load();
            setShowMovementModal(false);
          }}
        />
      )}
      {showCloseModal && (
        <CloseCashModal
          expected={expectedCash}
          opening={session.opening_amount}
          cashSales={cashSales}
          exits={exitsTotal}
          entries={entriesTotal}
          totalSales={totalSales}
          onClose={() => setShowCloseModal(false)}
          onClose2={async (realCash, notes) => {
            await closeCashSession(session.id, realCash, expectedCash, waiter?.name ?? 'Admin', notes);
            await load();
            await reload();
            setShowCloseModal(false);
          }}
        />
      )}
      {showHistory && (
        <Modal open onClose={() => setShowHistory(false)} title="Historial de caja" size="md">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto touch-scroll">
            {history.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 text-sm">
                <div className="flex-1">
                  <span className="font-medium text-stone-800">{formatDate(s.session_date)}</span>
                  <span className="text-xs text-stone-400 ml-2">{s.status === 'open' ? 'Abierta' : 'Cerrada'}</span>
                </div>
                {s.status === 'closed' && s.difference !== null && (
                  <span className={cn('font-semibold text-xs', Math.abs(s.difference) < 0.01 ? 'text-emerald-600' : 'text-red-600')}>
                    {Math.abs(s.difference) < 0.01 ? 'Cuadrado' : `Descuadre ${formatEUR(s.difference)}`}
                  </span>
                )}
                <span className="font-semibold text-stone-700">{formatEUR(s.closing_amount ?? s.opening_amount)}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function OpenCashModal({ onClose, onOpen }: { onClose: () => void; onOpen: (amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Apertura de caja" size="sm">
      <p className="text-sm text-stone-500 mb-4">Registra el fondo inicial (cambio) disponible en el cajón antes de empezar el servicio.</p>
      <label className="block text-sm font-medium text-stone-600 mb-1">Fondo de caja inicial</label>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-stone-400 text-lg">€</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" autoFocus
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" className="flex-1" disabled={busy} onClick={async () => {
          setBusy(true); try { await onOpen(parseFloat(amount) || 0); } finally { setBusy(false); }
        }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Abrir caja'}</Button>
      </div>
    </Modal>
  );
}

function MovementModal({ onClose, onAdd }: { onClose: () => void; onAdd: (amount: number, reason: string, type: 'exit' | 'entry') => Promise<void> }) {
  const [type, setType] = useState<'exit' | 'entry'>('exit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Nuevo movimiento de caja" size="sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setType('exit')} className={cn('flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium touch-tap',
            type === 'exit' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500')}>
            <ArrowDownToLine className="w-4 h-4" /> Salida
          </button>
          <button onClick={() => setType('entry')} className={cn('flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium touch-tap',
            type === 'entry' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-stone-200 text-stone-500')}>
            <ArrowUpFromLine className="w-4 h-4" /> Entrada
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Importe</label>
          <div className="flex items-center gap-2">
            <span className="text-stone-400">€</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" autoFocus
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Motivo</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Compra de pan, hielo…"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !amount || !reason} onClick={async () => {
            setBusy(true); try { await onAdd(parseFloat(amount) || 0, reason, type); } finally { setBusy(false); }
          }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CloseCashModal({
  expected, opening, cashSales, exits, entries, totalSales, onClose, onClose2,
}: {
  expected: number; opening: number; cashSales: number; exits: number; entries: number; totalSales: number;
  onClose: () => void; onClose2: (realCash: number, notes?: string) => Promise<void>;
}) {
  const [realCash, setRealCash] = useState(String(expected.toFixed(2)));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const real = parseFloat(realCash) || 0;
  const difference = real - expected;
  return (
    <Modal open onClose={onClose} title="Cierre Z · Arqueo de caja" size="md">
      <div className="space-y-4">
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-stone-500">Fondo inicial</span><span className="font-medium">{formatEUR(opening)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">+ Ventas en efectivo</span><span className="font-medium text-emerald-700">{formatEUR(cashSales)}</span></div>
          {entries > 0 && <div className="flex justify-between"><span className="text-stone-500">+ Entradas</span><span className="font-medium text-emerald-700">{formatEUR(entries)}</span></div>}
          <div className="flex justify-between"><span className="text-stone-500">− Salidas de caja</span><span className="font-medium text-orange-700">−{formatEUR(exits)}</span></div>
          <div className="flex justify-between border-t border-stone-200 pt-2"><span className="font-medium text-stone-700">Efectivo esperado en cajón</span><span className="font-bold text-stone-800">{formatEUR(expected)}</span></div>
          <div className="flex justify-between text-xs text-stone-400"><span>Ventas totales (efectivo + tarjeta)</span><span>{formatEUR(totalSales)}</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Efectivo real contado en cajón</label>
          <div className="flex items-center gap-2">
            <span className="text-stone-400 text-lg">€</span>
            <input value={realCash} onChange={(e) => setRealCash(e.target.value)} type="number" step="0.01" autoFocus
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div className={cn('rounded-xl p-4 flex items-center justify-between',
          Math.abs(difference) < 0.01 ? 'bg-emerald-50' : 'bg-red-50')}>
          <span className={cn('font-medium text-sm', Math.abs(difference) < 0.01 ? 'text-emerald-700' : 'text-red-700')}>
            {Math.abs(difference) < 0.01 ? 'Caja cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante'}
          </span>
          <span className={cn('text-2xl font-bold', Math.abs(difference) < 0.01 ? 'text-emerald-700' : 'text-red-700')}>
            {formatEUR(Math.abs(difference))}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Notas (opcional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Incidencias, observaciones…"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 min-h-[60px]" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" className="flex-1 flex items-center justify-center gap-2" disabled={busy} onClick={async () => {
            setBusy(true); try { await onClose2(real, notes || undefined); } finally { setBusy(false); }
          }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Cerrar caja</Button>
        </div>
      </div>
    </Modal>
  );
}
