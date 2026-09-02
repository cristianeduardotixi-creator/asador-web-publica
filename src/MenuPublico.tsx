import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatEUR } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import { Image as ImageIcon, Utensils, ShieldAlert, X } from 'lucide-react';

export function MenuPublico() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    async function loadMenu() {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from('categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('products').select('*').eq('available', true).order('sort_order', { ascending: true })
        ]);

        if (catRes.data) {
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
  const currentCategory = categories.find(c => c.id === activeCat);
  
  // Detectamos si la categoría actual es Bebidas
  const isBebidasCategory = currentCategory?.name.toLowerCase().includes('bebida');

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 pb-16 flex flex-col justify-between">
      <div>
        {/* Cabecera Adaptativa */}
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

        {/* Contenido Principal */}
        <main className="max-w-3xl mx-auto p-4 md:p-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-stone-400 text-sm bg-white rounded-2xl shadow-sm border border-stone-200 mt-4">
              No hay productos disponibles en esta categoría actualmente.
            </div>
          ) : isBebidasCategory ? (
            /* LISTADO CONTINUO Y ORDENADO PARA BEBIDAS */
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 md:p-8">
              <h2 className="text-center font-bold tracking-widest text-stone-800 text-base uppercase mb-6 pb-3 border-b-2 border-amber-600">
                {currentCategory?.name}
              </h2>
              <div className="divide-y divide-stone-100">
                {filteredProducts.map(p => (
                  <div key={p.id} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="pr-4">
                      <h3 className="font-medium text-stone-800 text-base">{p.name}</h3>
                      {p.description && (
                        <p className="text-xs text-stone-400 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span className="font-bold text-stone-900 text-base whitespace-nowrap">
                      {formatEUR(p.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* DISEÑO DE TARJETAS CON FOTO PARA EL RESTO DE PLATOS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex gap-4 items-start transition-all hover:shadow-md"
                >
                  {p.image_url ? (
                    <div 
                      onClick={() => setModalImage({ url: p.image_url!, name: p.name })}
                      className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-stone-50 border border-stone-100 shrink-0 shadow-inner p-1 cursor-pointer group relative overflow-hidden"
                      title="Haz clic para ampliar"
                    >
                      <img 
                        src={p.image_url} 
                        alt={p.name} 
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-md font-medium">Ampliar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                      <ImageIcon className="w-8 h-8 text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[110px]">
                    <div>
                      <h2 className="font-bold text-stone-900 text-base leading-snug">{p.name}</h2>
                      {p.description && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-4 leading-relaxed">
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

      {/* Modal para ver la imagen en grande */}
      {modalImage && (
        <div 
          onClick={() => setModalImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-4 relative shadow-2xl flex flex-col items-center animate-slideUp"
          >
            <button 
              onClick={() => setModalImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-lg text-stone-900 mb-3 text-center pr-8">{modalImage.name}</h3>
            <div className="w-full max-h-[70vh] flex items-center justify-center bg-stone-50 rounded-xl p-2 border border-stone-100 overflow-hidden">
              <img 
                src={modalImage.url} 
                alt={modalImage.name} 
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
            <p className="text-xs text-stone-400 mt-3 text-center">Haz clic fuera de la foto o en la X para cerrar</p>
          </div>
        </div>
      )}

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