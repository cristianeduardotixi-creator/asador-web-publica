import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatEUR } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import { Image as ImageIcon, Utensils, ShieldAlert } from 'lucide-react';

export function MenuPublico() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenu() {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from('categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('products').select('*').eq('available', true).order('sort_order', { ascending: true })
        ]);

        if (catRes.data) setCategories(catRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (catRes.data && catRes.data.length > 0) {
          setActiveCat(catRes.data[0].id);
        }
      } catch (e) {
        console.error('Error cargando carta pública', e);
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-100">
        <div className="flex flex-col items-center gap-2">
          <Utensils className="w-8 h-8 text-amber-600 animate-pulse" />
          <p className="text-stone-500 text-sm font-medium">Cargando carta...</p>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(p => p.category_id === activeCat);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 pb-16 flex flex-col justify-between">
      <div>
        {/* Cabecera Adaptativa */}
        <header className="bg-stone-900 text-white py-8 px-4 text-center shadow-md">
          <h1 className="text-2xl md:text-4xl font-bold tracking-wide">Asador Parla Este</h1>
          <p className="text-stone-400 text-xs md:text-sm mt-1">Descubre nuestra carta y especialidades</p>
        </header>

        {/* Categorías */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md shadow-sm z-20 px-4 py-3 border-b border-stone-200">
          <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto md:justify-center md:flex-wrap no-scrollbar">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all touch-tap ${
                  activeCat === c.id
                    ? 'bg-amber-600 text-white shadow-md scale-105'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido Principal con Grid Responsivo */}
        <main className="max-w-5xl mx-auto p-4 md:p-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-stone-400 text-sm bg-white rounded-2xl shadow-sm border border-stone-200 mt-4">
              No hay platos disponibles en esta categoría actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex gap-4 items-start transition-all hover:shadow-md"
                >
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      className="w-24 h-24 md:w-28 md:h-28 object-cover rounded-xl border border-stone-100 shrink-0 shadow-inner" 
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                      <ImageIcon className="w-8 h-8 text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                    <div>
                      <h2 className="font-bold text-stone-900 text-base leading-snug">{p.name}</h2>
                      {p.description && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-3 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="font-extrabold text-amber-700 text-base">
                        {formatEUR(p.price)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Pie de página con la Leyenda de Alérgenos y Nota Legal */}
      <footer className="max-w-4xl mx-auto mt-12 px-6 text-center text-xs text-stone-500 border-t border-stone-200 pt-6 space-y-3">
        <div className="flex items-center justify-center gap-1.5 font-semibold text-stone-700">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Leyenda de Alérgenos</span>
        </div>
        <p className="leading-relaxed">
          1. Gluten | 2. Crustáceos | 3. Huevos | 4. Pescado | 5. Cacahuetes | 6. Soja | 7. Lácteos | 8. Frutos de cáscara | 9. Apio | 10. Mostaza | 11. Sésamo | 12. Sulfitos | 13. Altramuces | 14. Moluscos
        </p>
        <p className="italic text-stone-400">
          "En cumplimiento del Reglamento (UE) Nº 1169/2011, disponemos de información detallada sobre alérgenos. Rogamos informe a nuestro personal en caso de alergia o intolerancia."
        </p>
      </footer>
    </div>
  );
}