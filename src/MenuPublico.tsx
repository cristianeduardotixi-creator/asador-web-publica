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

        if (catRes.data) {
          // Filtramos para ocultar "Envases / Táperes" y "Cafés y tés" de la carta pública
          const filteredCats = catRes.data.filter(c => {
            const name = c.name.toLowerCase();
            return (
              !name.includes('envase') &&
              !name.includes('táper') &&
              !name.includes('taper') &&
              !name.includes('cafés y tés') &&
              !name.includes('cafes y tes')
            );
          });
          setCategories(filteredCats);
          if (filteredCats.length > 0) {
            setActiveCat(filteredCats[0].id);
          }
        }
        if (prodRes.data) setProducts(prodRes.data);
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
        {/* Cabecera Adaptativa: Logotipo alineado a la izquierda del texto */}
        <header className="bg-stone-900 text-white py-6 px-4 shadow-md">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-4 text-center sm:text-left">
            <img 
              src="https://vhaxjxtzzgfiqfltzonl.supabase.co/storage/v1/object/public/logos/Logo%20Asador%20Parla%20Este%20.jpg" 
              alt="Logo Asador Parla Este" 
              className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border-2 border-amber-600 shadow-md bg-white shrink-0"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-wide">Asador Parla Este</h1>
              <p className="text-stone-400 text-xs md:text-sm mt-0.5">Descubre nuestra carta y especialidades</p>
            </div>
          </div>
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
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[110px]">
                    <div>
                      <h2 className="font-bold text-stone-900 text-base leading-snug">{p.name}</h2>
                      {p.description && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-5 leading-relaxed">
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