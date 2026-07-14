import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Search, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

export const Catalog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const { addItem, removeItem, updateQuantity, items } = useCartStore();

  // const allProducts = useLiveQuery(() => db.products.toArray(), []);

  // Extraer categorías únicas de los productos descargados
  // const categories = ['Todas', ...Array.from(new Set(allProducts?.map(p => p.category || 'Otras Categorías') || [])).sort()];

  const products = useLiveQuery(
    () => {
      let query = db.products.toCollection();

      // if (selectedCategory !== 'Todas') {
      //   query = db.products.filter(p => (p.category || 'Otras Categorías') === selectedCategory);
      // }

      if (searchTerm) {
        return query.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || Boolean(p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))).toArray();
      }

      return query.toArray();
    },
    [searchTerm]
  );

  const getQuantityInCart = (productId: string) => {
    const item = items.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Buscador y Filtros */}
      <div className="flex flex-col space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
            placeholder="Buscar producto por nombre o SKU..." 
          />
        </div>

        {/* Menú de Categorías Oculto Temporalmente 
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm ${
                selectedCategory === cat 
                  ? 'bg-blue-600 text-white border border-blue-600' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        */}
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {!products && <p className="text-gray-500 text-center py-4">Cargando catálogo...</p>}
        {products && products.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200 shadow-sm col-span-full">
            <PackageIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p>No se encontraron productos.</p>
            <p className="text-xs mt-1">Asegúrate de descargar el catálogo al iniciar sesión.</p>
          </div>
        )}
        
        {products?.map(p => {
          const inCart = getQuantityInCart(p.id!);
          
          return (
            <article key={p.id} className="flex flex-col group bg-white rounded-md cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md border border-gray-200 overflow-hidden h-full">
              {/* Imagen del producto */}
              <div className="relative w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {(p.local_image_base64 || p.image_url) ? (
                  <img src={p.local_image_base64 || p.image_url} alt={p.name} className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${p.stock <= 0 ? 'opacity-50 grayscale' : ''}`} />
                ) : (
                  <span className="text-gray-400 text-xs">Sin Imagen</span>
                )}
                {/* Badge de Disponibilidad */}
                <div className={`absolute top-2 left-2 px-2 py-1 text-[10px] font-bold text-white rounded shadow-sm ${p.stock > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                  {p.stock > 0 ? `DISP: ${p.stock}` : 'AGOTADO'}
                </div>
              </div>
              
              {/* Detalles */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">SKU: {p.sku || 'N/A'} • Stock: {p.stock}</p>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-blue-600 text-base sm:text-lg">
                      ${(p.price * (1 + (p.taxRate ?? 0) / 100)).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {(p.taxRate ?? 0) > 0 ? `Inc. IVA ${p.taxRate}%` : 'Exento'}
                    </span>
                  </div>
                  
                  {inCart > 0 ? (
                    <div className="flex items-center space-x-1 bg-indigo-50 rounded-full border border-indigo-100 p-1">
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); inCart === 1 ? removeItem(p.id!) : updateQuantity(p.id!, inCart - 1); }}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-white text-indigo-600 rounded-full hover:bg-indigo-100 shadow-sm transition-colors"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs sm:text-sm text-indigo-900 w-4 sm:w-5 text-center">{inCart}</span>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(p.id!, inCart + 1); }}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
                        disabled={inCart >= p.stock}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem({ product_id: p.id!, name: p.name, price: p.price, quantity: 1, stock: p.stock, taxRate: p.taxRate }); }}
                      className={`text-white p-2 rounded-full transition-colors relative shadow-sm disabled:opacity-50 ${p.stock > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'}`}
                      title={p.stock > 0 ? "Añadir al carrito" : "Agotado"}
                      disabled={p.stock <= 0}
                    >
                      <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const PackageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
