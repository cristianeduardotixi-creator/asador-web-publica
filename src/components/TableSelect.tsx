import { MapPin, Wallet, Link2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { RestaurantTable } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';

const sectionLabels: Record<string, string> = {
  Sala: 'Sala',
  Terraza: 'Terraza',
  Barra: 'Barra',
};

const statusColors: Record<string, string> = {
  free: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400',
  occupied: 'border-amber-400 bg-amber-50 hover:bg-amber-100 hover:border-amber-500',
  reserved: 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400',
};

const statusDot: Record<string, string> = {
  free: 'bg-emerald-500',
  occupied: 'bg-amber-500',
  reserved: 'bg-blue-500',
};

const sectionOrder = ['Barra', 'Sala', 'Terraza'];

export function TableSelect({ onSelect }: { onSelect: (t: RestaurantTable) => void }) {
  const { tables, loading, tableOrders } = useApp();

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Cargando mesas…</div>;
  }

  const sections = [...new Set(tables.map((t) => t.section))].sort(
    (a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
  );

  function handleSelect(t: RestaurantTable) {
    if (t.merged_into) {
      return; // Bloqueado: no permite seleccionar mesas unidas secundarias
    }
    onSelect(t);
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-stone-800 mb-1">Selecciona una mesa</h2>
      <p className="text-stone-500 text-sm mb-6">Toca una mesa libre u ocupada para gestionar la comanda.</p>

      {sections.map((section) => (
        <div key={section} className="mb-8">
          <div className="flex items-center gap-2 mb-3 text-stone-600">
            <MapPin className="w-4 h-4" />
            <h3 className="font-semibold">{sectionLabels[section] ?? section}</h3>
            <span className="text-xs text-stone-400">
              ({tables.filter((t) => t.section === section && t.status === 'free').length} libres)
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {tables
              .filter((t) => t.section === section)
              .map((t) => (
                <TableCard key={t.id} t={t} tables={tables} tableOrders={tableOrders} onSelect={handleSelect} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableCard({
  t,
  tables,
  tableOrders,
  onSelect,
}: {
  t: RestaurantTable;
  tables: RestaurantTable[];
  tableOrders: Record<string, { total: number }>;
  onSelect: (t: RestaurantTable) => void;
}) {
  const primaryName = t.merged_into
    ? tables.find((p) => p.id === t.merged_into)?.name
    : null;
  const mergedCount = t.merged_into
    ? 0
    : tables.filter((x) => x.merged_into === t.id).length;
  const total = tableOrders[t.id]?.total ?? 0;
  const isMergedSecondary = !!t.merged_into;

  return (
    <button
      onClick={() => onSelect(t)}
      disabled={isMergedSecondary}
      className={cn(
        'touch-tap relative rounded-2xl border-2 p-4 text-left transition-all',
        isMergedSecondary
          ? 'border-stone-300 bg-stone-100 opacity-75 cursor-not-allowed'
          : statusColors[t.status],
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('w-2.5 h-2.5 rounded-full', isMergedSecondary ? 'bg-stone-400' : statusDot[t.status])} />
        {mergedCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
            <Link2 className="w-3 h-3" /> {mergedCount}
          </span>
        )}
      </div>
      <div className="text-lg font-bold text-stone-800">{t.name}</div>
      <div className="text-xs text-stone-500 mt-1 capitalize">
        {primaryName
          ? `Unida a ${primaryName}`
          : t.status === 'free'
            ? 'Libre'
            : t.status === 'occupied'
              ? 'Ocupada'
              : 'Reservada'}
      </div>
      {t.status === 'occupied' && total > 0 && !isMergedSecondary && (
        <div className="mt-2 flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
          <Wallet className="w-3.5 h-3.5" /> {formatEUR(total)}
        </div>
      )}
    </button>
  );
}