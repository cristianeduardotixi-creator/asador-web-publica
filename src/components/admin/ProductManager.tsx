import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X, Save, Eye, EyeOff, Check, Image as ImageIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Modal, Badge } from '@/components/ui';
import { formatEUR } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

export function ProductManager() {
  const { categories, products, reload } = useApp();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    if (filterCat !== 'all' && p.category_id !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function saveProduct(p: Partial<Product>) {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const { error } = await supabase.from('products').update({
          name: p.name, price: p.price, iva_rate: p.iva_rate,
          category_id: p.category_id, description: p.description,
          image_url: p.image_url,
          print_destination: p.print_destination,
          available: p.available, sort_order: p.sort_order, stock_actual: p.stock_actual,
        }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert({
          category_id: p.category_id, name: p.name, price: p.price,
          iva_rate: p.iva_rate, description: p.description,
          image_url: p.image_url,
          print_destination: p.print_destination,
          available: p.available ?? true, sort_order: p.sort_order ?? 0,
          stock_actual: p.stock_actual ?? 0,
        });
        if (error) throw error;
      }
      await reload();
      setEditing(null);
      setCreating(false);
      setToast(editing ? 'Producto actualizado correctamente' : 'Producto guardado correctamente');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(p: Product) {
    const { error } = await supabase.from('products').update({ available: !p.available }).eq('id', p.id);
    if (error) return;
    await reload();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) return;
    await reload();
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Productos</h1>
          <p className="text-stone-500 text-sm">{products.length} productos · {categories.length} categorías</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo producto
        </Button>
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
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Producto</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Destino</th>
              <th className="text-right px-4 py-3 font-medium">Precio</th>
              <th className="text-center px-4 py-3 font-medium">Disp.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              const dest = p.print_destination ?? cat?.print_destination ?? 'kitchen';
              return (
                <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800 flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-stone-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <span>{p.name}</span>
                      {p.description && <p className="text-xs text-stone-400 font-normal line-clamp-1">{p.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{cat?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge color={dest === 'bar' ? 'blue' : 'orange'}>{dest === 'bar' ? 'Barra' : 'Cocina'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-stone-700">{formatEUR(p.price)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleAvailable(p)} className="touch-tap">
                      {p.available
                        ? <Eye className="w-4 h-4 text-emerald-600 mx-auto" />
                        : <EyeOff className="w-4 h-4 text-stone-300 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-stone-100 touch-tap">
                        <Pencil className="w-4 h-4 text-stone-500" />
                      </button>
                      <button onClick={() => deleteProduct(p)} className="p-1.5 rounded-lg hover:bg-red-50 touch-tap">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-stone-400 py-8 text-sm">No se encontraron productos.</p>}
      </Card>

      {(editing || creating) && (
        <ProductForm
          product={editing}
          categories={categories}
          onSave={saveProduct}
          onClose={() => { setEditing(null); setCreating(false); setError(null); }}
          saving={saving}
          error={error}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-lg text-sm font-medium">
            <Check className="w-5 h-5" /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  product, categories, onSave, onClose, saving, error,
}: {
  product: Product | null;
  categories: Category[];
  onSave: (p: Partial<Product>) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [iva, setIva] = useState(String(product?.iva_rate ?? '10'));
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '');
  const [dest, setDest] = useState<'kitchen' | 'bar' | ''>(product?.print_destination ?? '');
  const [available, setAvailable] = useState(product?.available ?? true);
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));
  const [stock, setStock] = useState(String(product?.stock_actual ?? 0));

  return (
    <Modal open onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'} size="md">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Descripción (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ej. Incluye chorizo criollo, chuletón, presa y pollo" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">URL de la imagen (opcional)</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Precio (€)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">IVA (%)</label>
            <select value={iva} onChange={(e) => setIva(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
              <option value="10">10% (hostelería)</option>
              <option value="21">21% (bebidas)</option>
              <option value="4">4% (reducido)</option>
              <option value="0">0% (exento)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Categoría</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Destino de impresión</label>
          <select value={dest} onChange={(e) => setDest(e.target.value as 'kitchen' | 'bar' | '')} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
            <option value="">Heredar de categoría</option>
            <option value="kitchen">Cocina</option>
            <option value="bar">Barra</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Orden</label>
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Disponible</label>
            <button onClick={() => setAvailable((a) => !a)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm flex items-center justify-center gap-2 touch-tap">
              {available ? <><Eye className="w-4 h-4 text-emerald-600" /> Sí</> : <><EyeOff className="w-4 h-4 text-stone-400" /> No</>}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Stock inicial (unidades)</label>
          <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" disabled={saving || !name} onClick={() => onSave({
            name, description: description.trim() || null, image_url: imageUrl.trim() || null, price: parseFloat(price) || 0, iva_rate: parseFloat(iva) || 0,
            category_id: categoryId, print_destination: dest || null, available, sort_order: parseInt(sortOrder) || 0,
            stock_actual: parseInt(stock) || 0,
          })}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}