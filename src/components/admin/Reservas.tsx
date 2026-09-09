import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Calendar, Clock, Users, Phone, X, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Card, Modal, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { fetchReservations, createReservation, updateReservation, deleteReservation } from '@/lib/api';
import type { Reservation, RestaurantTable } from '@/lib/types';

export function Reservas() {
  const { tables } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchReservations(date);
      setReservations(r);
    } catch (e) {
      console.error('Reservas load error:', e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Reservas</h1>
          <p className="text-stone-500 text-sm">Agenda de reservas del restaurante</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nueva reserva
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-stone-400" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        <span className="text-sm text-stone-500">{reservations.length} reserva(s)</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : reservations.length === 0 ? (
        <Card className="p-10 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay reservas para {formatDate(date)}.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.sort((a, b) => (a.reservation_time || "").localeCompare(b.reservation_time || "")).map((r) => {
            const table = tables.find((t) => t.id === r.table_id);
            return (
              <Card key={r.id} className={cn('p-4 border-2', r.status === 'cancelled' ? 'border-stone-200 opacity-50' : 'border-stone-200')}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center bg-amber-50 rounded-xl px-3 py-2 shrink-0">
                    <Clock className="w-4 h-4 text-amber-600 mb-1" />
                    <span className="font-bold text-stone-800 text-sm">{r.reservation_time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-stone-800">{r.customer_name}</span>
                      <Badge color={r.status === 'confirmed' ? 'blue' : r.status === 'seated' ? 'emerald' : 'red'}>
                        {r.status === 'confirmed' ? 'Confirmada' : r.status === 'seated' ? 'Sentado' : r.status === 'no_show' ? 'No show' : 'Cancelada'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                      {table && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {table.name}</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.party_size} pers.</span>
                      {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                    </div>
                    {r.notes && <p className="text-xs text-stone-400 italic mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.status === 'confirmed' && (
                      <button onClick={() => updateReservation(r.id, { status: 'seated' }).then(load)}
                        className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 touch-tap" title="Marcar sentado">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteReservation(r.id).then(load)}
                      className="p-2 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 touch-tap" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <ReservationForm
          tables={tables}
          date={date}
          onClose={() => setShowForm(false)}
          onSave={async (r) => {
            await createReservation(r);
            await load();
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function ReservationForm({
  tables, date, onClose, onSave,
}: {
  tables: RestaurantTable[];
  date: string;
  onClose: () => void;
  onSave: (r: Omit<Reservation, 'id' | 'created_at'>) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [reservationDate, setReservationDate] = useState(date);
  const [reservationTime, setReservationTime] = useState('14:00');
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} title="Nueva reserva" size="md">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Nombre del cliente *</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Personas</label>
            <input value={partySize} onChange={(e) => setPartySize(e.target.value)} type="number" min="1"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Fecha</label>
            <input type="date" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Hora</label>
            <input type="time" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Mesa (opcional)</label>
          <select value={tableId} onChange={(e) => setTableId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
            <option value="">Sin asignar</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.section})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Notas</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferencias, occasion especial…"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !customerName} onClick={async () => {
            setBusy(true);
            try {
              await onSave({
                table_id: tableId || null,
                table_name: tables.find((t) => t.id === tableId)?.name ?? null,
                customer_name: customerName,
                phone: phone || null,
                party_size: parseInt(partySize) || 2,
                reservation_date: reservationDate,
                reservation_time: reservationTime,
                status: 'confirmed',
                notes: notes || null,
              });
            } finally { setBusy(false); }
          }}>Guardar reserva</Button>
        </div>
      </div>
    </Modal>
  );
}
