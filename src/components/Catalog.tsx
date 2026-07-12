import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Search, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

export const Catalog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { addItem, items } = useCartStore();

  const products = useLiveQuery(
    () => {
      if (searchTerm) {
        return db.products
          .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || Boolean(p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())))
          .toArray();
      }
      return db.products.toArray();
    },
    [searchTerm]
  );

  const getQuantityInCart = (productId: string) => {
    const item = items.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Buscador */}
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

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <span className="text-gray-400 text-xs">Sin Imagen</span>
                )}
              </div>
              
              {/* Detalles */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">SKU: {p.sku || 'N/A'} • Stock: {p.stock}</p>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <span className="font-extrabold text-blue-600 text-lg">${p.price.toFixed(2)}</span>
                  
                  <button 
                    onClick={() => addItem({ product_id: p.id!, name: p.name, price: p.price, quantity: 1, stock: p.stock })}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 p-2 rounded-full transition-colors relative shadow-sm"
                    title="Añadir al carrito"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {inCart > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                        {inCart}
                      </span>
                    )}
                  </button>
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
