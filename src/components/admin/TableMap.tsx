import { useState } from 'react';
import { Plus, Save, Wallet, FileText, Link2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Modal, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import type { RestaurantTable } from '@/lib/types';

const sectionOrder = ['Barra', 'Sala', 'Terraza'];

const statusColors: Record<string, string> = {
  free: 'border-emerald-300 bg-emerald-50',
  occupied: 'border-amber-400 bg-amber-50',
  reserved: 'border-blue-300 bg-blue-50',
  requesting_bill: 'border-orange-500 bg-orange-50',
};

export function TableMap({
  onPay,
  onManage,
}: {
  onPay?: (table: RestaurantTable) => void;
  onManage?: (table: RestaurantTable) => void;
}) {
  const { tables, tableOrders, reload } = useApp();
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [creating, setCreating] = useState(false);

  const sections = [...new Set(tables.map((t) => t.section))].sort(
    (a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
  );

  async function saveTable(t: Partial<RestaurantTable>) {
    if (editing) {
      await supabase.from('restaurant_tables').update({
        name: t.name, section: t.section,
        pos_x: t.pos_x, pos_y: t.pos_y, status: t.status,
      }).eq('id', editing.id);
    } else {
      await supabase.from('restaurant_tables').insert({
        table_number: t.name, name: t.name, section: t.section ?? 'Sala',
        area: t.section ?? 'Sala', pos_x: t.pos_x ?? 1, pos_y: t.pos_y ?? 1,
        status: 'free', active: true, seats: 4,
      });
    }
    await reload();
    setEditing(null);
    setCreating(false);
  }

  async function unmergeTable(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('restaurant_tables').update({ merged_into: null, status: 'free' }).eq('id', id);
    await reload();
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Mapa de mesas</h1>
          <p className="text-stone-500 text-sm">{tables.length} mesas · {sections.length} zonas</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva mesa
        </Button>
      </div>

      {sections.map((section) => (
        <div key={section} className="mb-6">
          <h3 className="font-semibold text-stone-700 mb-3">{section}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {tables.filter((t) => t.section === section).map((t) => {
              const primaryName = t.merged_into ? tables.find((p) => p.id === t.merged_into)?.name : null;
              const mergedCount = tables.filter((x) => x.merged_into === t.id).length;
              const total = tableOrders[t.id]?.total ?? 0;
              const isMergedSecondary = !!t.merged_into;

              return (
                <Card key={t.id} className={cn('p-3 border-2 flex flex-col gap-2', statusColors[t.status])}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800 text-sm">{t.name}</span>
                    <Badge color={t.status === 'occupied' ? 'amber' : t.status === 'requesting_bill' ? 'orange' : 'emerald'}>
                      {t.status === 'free' ? 'Libre' : t.status === 'occupied' ? 'Ocupada' : t.status === 'requesting_bill' ? 'Cuenta' : 'Reservada'}
                    </Badge>
                  </div>
                  {primaryName && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 w-fit">
                      <Link2 className="w-3 h-3" /> Unida a {primaryName}
                    </div>
                  )}
                  {mergedCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                      <Link2 className="w-3 h-3" /> {mergedCount} mesa{mergedCount !== 1 ? 's' : ''} unida{mergedCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {t.status === 'occupied' && total > 0 && (
                    <div className="flex items-center gap-1 text-sm font-bold text-emerald-700">
                      <Wallet className="w-3.5 h-3.5" /> {formatEUR(total)}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <button
                      onClick={() => onPay?.(t)}
                      disabled={t.status === 'free' || isMergedSecondary}
                      className={cn(
                        'w-full flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium touch-tap transition-colors',
                        t.status !== 'free' && !isMergedSecondary
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-stone-100 text-stone-400 cursor-not-allowed',
                      )}
                    >
                      <Wallet className="w-3.5 h-3.5" /> Cobrar
                    </button>
                    <button
                      onClick={() => onManage?.(t)}
                      disabled={t.status === 'free' || isMergedSecondary}
                      className={cn(
                        'w-full flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium touch-tap transition-colors',
                        t.status !== 'free' && !isMergedSecondary
                          ? 'bg-stone-800 text-white hover:bg-stone-900'
                          : 'bg-stone-100 text-stone-400 cursor-not-allowed',
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" /> Gestionar
                    </button>
                    {primaryName && (
                      <button
                        onClick={(e) => unmergeTable(t.id, e)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 touch-tap transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Separar
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {(editing || creating) && (
        <TableForm table={editing} onSave={saveTable} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function TableForm({
  table,
  onSave,
  onClose,
}: {
  table: RestaurantTable | null;
  onSave: (t: Partial<RestaurantTable>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(table?.name ?? '');
  const [section, setSection] = useState(table?.section ?? 'Sala');
  const [posX, setPosX] = useState(String(table?.pos_x ?? 1));
  const [posY, setPosY] = useState(String(table?.pos_y ?? 1));

  return (
    <Modal open onClose={onClose} title={table ? 'Editar mesa' : 'Nueva mesa'} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Zona</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
            <option>Sala</option><option>Terraza</option><option>Barra</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Posición X</label>
            <input value={posX} onChange={(e) => setPosX(e.target.value)} type="number" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Posición Y</label>
            <input value={posY} onChange={(e) => setPosY(e.target.value)} type="number" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" disabled={!name} onClick={() => onSave({
            name, section, pos_x: parseInt(posX) || 1, pos_y: parseInt(posY) || 1,
          })}>
            <Save className="w-4 h-4" /> Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}