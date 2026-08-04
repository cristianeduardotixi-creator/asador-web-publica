import { useState, useMemo } from 'react';
import {
  PackagePlus, AlertTriangle, Package, Search,
  TrendingUp, Save, Ban, Pencil,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { addStock, setStock } from '@/lib/api';
import { Button, Card, Modal, Badge, EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import type { Product } from '@/lib/types';

const LOW_STOCK_THRESHOLD = 4;

export function Inventory() {
  const { products, categories, reload, loading } = useApp();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
  const [entryModal, setEntryModal] = useState<Product | null>(null);
  const [editModal, setEditModal] = useState<Product | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const enriched = useMemo(() => products.map((p) => ({
    ...p,
    categoryName: categories.find((c) => c.id === p.category_id)?.name ?? '—',
    isLow: p.stock_actual > 0 && p.stock_actual <= LOW_STOCK_THRESHOLD,
    isOut: p.stock_actual <= 0,
  })), [products, categories]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      if (filterCat !== 'all' && p.category_id !== filterCat) return false;
      if (filterStatus === 'low' && !(p.isLow && !p.isOut)) return false;
      if (filterStatus === 'out' && !p.isOut) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [enriched, filterCat, filterStatus, search]);

  const lowCount = enriched.filter((p) => p.isLow && !p.isOut).length;
  const outCount = enriched.filter((p) => p.isOut).length;
  const totalUnits = enriched.reduce((s, p) => s + p.stock_actual, 0);

  async function handleRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Inventario</h1>
          <p className="text-stone-500 text-sm">{products.length} productos · {totalUnits} unidades en stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2">
            {refreshing ? <Spinner className="w-4 h-4" /> : <Package className="w-4 h-4" />} Actualizar
          </Button>
        </div>
      </div>

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className={cn('p-4', outCount > 0 && 'border-red-300 bg-red-50')}>
          <div className="flex items-center gap-2">
            <Ban className={cn('w-5 h-5', outCount > 0 ? 'text-red-600' : 'text-stone-300')} />
            <div>
              <p className={cn('text-2xl font-bold', outCount > 0 ? 'text-red-700' : 'text-stone-800')}>{outCount}</p>
              <p className="text-xs text-stone-500">Agotados</p>
            </div>
          </div>
        </Card>
        <Card className={cn('p-4', lowCount > 0 && 'border-orange-300 bg-orange-50')}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('w-5 h-5', lowCount > 0 ? 'text-orange-600' : 'text-stone-300')} />
            <div>
              <p className={cn('text-2xl font-bold', lowCount > 0 ? 'text-orange-700' : 'text-stone-800')}>{lowCount}</p>
              <p className="text-xs text-stone-500">Stock bajo (≤{LOW_STOCK_THRESHOLD})</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-stone-800">{totalUnits}</p>
              <p className="text-xs text-stone-500">Unidades totales</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1 p-1 bg-stone-100 rounded-xl">
          {([
            { v: 'all', l: 'Todos' },
            { v: 'low', l: 'Stock bajo' },
            { v: 'out', l: 'Agotados' },
          ] as const).map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterStatus(f.v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-tap whitespace-nowrap',
                filterStatus === f.v ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500',
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Stock table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-12 h-12" />} title="No hay productos" subtitle="Ajusta los filtros o añade productos." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Producto</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium">Precio</th>
                <th className="text-center px-4 py-3 font-medium">Stock</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={cn(
                  'border-t border-stone-100 hover:bg-stone-50',
                  p.isOut && 'bg-red-50/50',
                  p.isLow && !p.isOut && 'bg-orange-50/50',
                )}>
                  <td className="px-4 py-3 font-medium text-stone-800">{p.name}</td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{p.categoryName}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{formatEUR(p.price)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'font-bold text-lg',
                      p.isOut ? 'text-red-600' : p.isLow ? 'text-orange-600' : 'text-stone-800',
                    )}>{p.stock_actual}</span>
                    <span className="text-xs text-stone-400 ml-1">ud.</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isOut ? (
                      <Badge color="red"><Ban className="w-3 h-3 mr-0.5" /> Agotado</Badge>
                    ) : p.isLow ? (
                      <Badge color="orange"><AlertTriangle className="w-3 h-3 mr-0.5" /> Stock bajo</Badge>
                    ) : (
                      <Badge color="emerald">OK</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEntryModal(p)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 touch-tap"
                      >
                        <PackagePlus className="w-3.5 h-3.5" /> Entrada
                      </button>
                      <button
                        onClick={() => setEditModal(p)}
                        className="p-1.5 rounded-lg hover:bg-stone-100 touch-tap"
                      >
                        <Pencil className="w-4 h-4 text-stone-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {entryModal && (
        <StockEntryModal product={entryModal} onClose={() => setEntryModal(null)} onSaved={handleRefresh} />
      )}
      {editModal && (
        <StockEditModal product={editModal} onClose={() => setEditModal(null)} onSaved={handleRefresh} />
      )}
    </div>
  );
}

function StockEntryModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('10');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setSaving(true);
    await addStock(product.id, parseInt(qty) || 0);
    setSaving(false);
    setDone(true);
    setTimeout(() => { onSaved(); onClose(); }, 600);
  }

  return (
    <Modal open onClose={onClose} title="Registrar entrada de stock" size="sm">
      <div className="space-y-4">
        <div className="bg-stone-50 rounded-xl p-3">
          <p className="font-semibold text-stone-800">{product.name}</p>
          <p className="text-sm text-stone-500">Stock actual: <span className="font-bold text-stone-700">{product.stock_actual} ud.</span></p>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Unidades a añadir</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            autoFocus
          />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[5, 10, 24, 48].map((v) => (
              <button key={v} onClick={() => setQty(String(v))} className="py-2 rounded-lg bg-stone-100 hover:bg-emerald-100 text-sm font-medium touch-tap">
                +{v}
              </button>
            ))}
          </div>
        </div>
        {done && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm bg-emerald-50 rounded-xl p-3">
            <TrendingUp className="w-4 h-4" /> Entrada registrada correctamente.
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="success" className="flex-1 flex items-center justify-center gap-2" disabled={saving || !qty} onClick={handleSave}>
            {saving ? <Spinner className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />} {saving ? 'Guardando…' : 'Registrar entrada'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StockEditModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(String(product.stock_actual));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await setStock(product.id, parseInt(qty) || 0);
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Ajustar stock" size="sm">
      <div className="space-y-4">
        <div className="bg-stone-50 rounded-xl p-3">
          <p className="font-semibold text-stone-800">{product.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Stock actual (unidades)</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            autoFocus
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" disabled={saving} onClick={handleSave}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
