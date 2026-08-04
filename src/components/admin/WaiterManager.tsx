import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, UserCheck, UserX, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Modal, Badge } from '@/components/ui';
import type { Waiter } from '@/lib/types';

export function WaiterManager() {
  const { waiters, reload } = useApp();
  const [editing, setEditing] = useState<Waiter | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [supaWaiters, setSupaWaiters] = useState<Waiter[]>([]);
  async function loadAll() {
    const { data } = await supabase.from('waiters').select('*').order('name');
    setSupaWaiters(data ?? []);
  }
  useEffect(() => { if (showAll) loadAll(); }, [showAll]);

  const list = showAll ? supaWaiters : waiters;

  async function saveWaiter(w: Partial<Waiter>) {
    if (editing) {
      await supabase.from('waiters').update({
        name: w.name, pin: w.pin, active: w.active,
      }).eq('id', editing.id);
    } else {
      await supabase.from('waiters').insert({
        name: w.name, pin: w.pin, active: w.active ?? true,
      });
    }
    await reload();
    if (showAll) await loadAll();
    setEditing(null);
    setCreating(false);
  }

  async function toggleActive(w: Waiter) {
    await supabase.from('waiters').update({ active: !w.active }).eq('id', w.id);
    await reload();
    if (showAll) await loadAll();
  }

  async function deleteWaiter(w: Waiter) {
    if (!confirm(`¿Eliminar al camarero "${w.name}"?`)) return;
    await supabase.from('waiters').delete().eq('id', w.id);
    await reload();
    if (showAll) await loadAll();
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Camareros / Personal</h1>
          <p className="text-stone-500 text-sm">{waiters.length} camareros activos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAll((v) => !v); if (!showAll) loadAll(); }}
            className={showAll ? 'text-xs px-3 py-2 rounded-lg bg-stone-200 text-stone-700' : 'text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 touch-tap'}
          >
            {showAll ? 'Ver solo activos' : 'Ver todos'}
          </button>
          <Button variant="primary" onClick={() => setCreating(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo camarero
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {list.map((w) => (
          <Card key={w.id} className="p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${w.active ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'}`}>
              {w.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-800">{w.name}</span>
                {w.active
                  ? <Badge color="emerald"><UserCheck className="w-3 h-3 mr-0.5" /> Activo</Badge>
                  : <Badge color="stone"><UserX className="w-3 h-3 mr-0.5" /> Inactivo</Badge>}
              </div>
              <div className="text-sm text-stone-500 font-mono mt-0.5">PIN: {w.pin}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggleActive(w)} className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 touch-tap">
                {w.active ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => setEditing(w)} className="p-1.5 rounded-lg hover:bg-stone-100 touch-tap">
                <Pencil className="w-4 h-4 text-stone-500" />
              </button>
              <button onClick={() => deleteWaiter(w)} className="p-1.5 rounded-lg hover:bg-red-50 touch-tap">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </Card>
        ))}
        {list.length === 0 && (
          <Card className="p-8 text-center text-stone-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            No hay camareros registrados.
          </Card>
        )}
      </div>

      {(editing || creating) && (
        <WaiterForm waiter={editing} onSave={saveWaiter} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function WaiterForm({ waiter, onSave, onClose }: { waiter: Waiter | null; onSave: (w: Partial<Waiter>) => void; onClose: () => void }) {
  const [name, setName] = useState(waiter?.name ?? '');
  const [pin, setPin] = useState(waiter?.pin ?? '');
  const [active, setActive] = useState(waiter?.active ?? true);

  return (
    <Modal open onClose={onClose} title={waiter ? 'Editar camarero' : 'Nuevo camarero'} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Laura, Carlos…" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">PIN de acceso</label>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="4-6 dígitos" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
          Activo (puede iniciar sesión)
        </label>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" disabled={!name || pin.length < 4} onClick={() => onSave({ name, pin, active })}>
            <Save className="w-4 h-4" /> Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
