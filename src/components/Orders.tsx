import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { OrderItem } from '../db/db';
import { Trash2, ShoppingBag, Plus, Minus, CheckCircle, Edit, X, Share2 } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { generateOrderPDF } from '../utils/pdfGenerator';

export const Orders = () => {
  const { items, removeItem, updateQuantity, clearCart, getTotal, selectedCustomerId, setCustomer } = useCartStore();
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Listar clientes para el selector
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  // Listar órdenes previas
  const localOrders = useLiveQuery(() => db.orders.toArray()) || [];

  const handleCheckout = () => {
    if (items.length === 0) return alert('El carrito está vacío');
    if (!selectedCustomerId) return alert('Debes seleccionar un cliente');
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSubmit = async (orderData: any) => {
    try {
      await db.orders.add({
        customer_id: selectedCustomerId,
        items: items as OrderItem[],
        total: getTotal(),
        sync_status: 'pending',
        created_at: Date.now(),
        ...orderData
      });

      setIsCheckoutOpen(false);
      clearCart();
      alert('Pedido guardado exitosamente de forma local.');
    } catch (err) {
      console.error(err);
      alert('Error guardando el pedido localmente');
    }
  };

  const handleEditOrder = async (order: any) => {
    if (items.length > 0) {
      const confirm = window.confirm('Tienes un carrito activo. ¿Deseas reemplazarlo con los items de este pedido?');
      if (!confirm) return;
    }
    clearCart();
    setCustomer(order.customer_id);
    // Para simplificar, suponemos que el store tiene addItem, 
    // pero si no, habría que agregarlo. Si no existe addItem, modificamos directamente el store
    useCartStore.setState({ items: order.items, selectedCustomerId: order.customer_id });
    await db.orders.delete(Number(order.id));
  };

  const handleDeleteOrder = async (id: number | string) => {
    if (window.confirm('¿Seguro que deseas eliminar este pedido local?')) {
      await db.orders.delete(Number(id));
    }
  };

  const handleWhatsAppShare = async (order: any, customer: any) => {
    try {
      const file = await generateOrderPDF(order, customer);
      
      const phoneText = customer?.phone ? customer.phone.replace(/\D/g, '') : '';
      const orderId = order.id || order.backend_id || 'PENDIENTE';
      const textMessage = `Hola ${customer?.name || ''}, aquí tienes el resumen de tu pedido N° ${orderId} por $${order.total.toFixed(2)}.`;
      
      // Opción 2: Descargar archivo y abrir chat directo (Evita tener que guardar el contacto)
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Esperar un instante para que el navegador inicie la descarga antes de cambiar de app
      setTimeout(() => {
        const waUrl = `https://wa.me/${phoneText}?text=${encodeURIComponent(textMessage)}`;
        window.open(waUrl, '_blank');
      }, 500);
      
    } catch (err) {
      console.error('Error generando/compartiendo PDF:', err);
      alert('Hubo un error al generar el recibo.');
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 p-4 text-white">
          <h2 className="font-bold text-lg flex items-center">
            <ShoppingBag className="mr-2 w-5 h-5" />
            Carrito Actual
          </h2>
        </div>
        
        <div className="p-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay productos en el carrito.</p>
          ) : (
            <div className="space-y-4">
              {/* Lista de Items */}
              <ul className="divide-y divide-gray-100">
                {items.map(item => (
                  <li key={item.product_id} className="py-3 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                      <p className="text-blue-600 font-bold">${item.price.toFixed(2)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center bg-gray-100 rounded-lg">
                        <button 
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded-l-lg transition-colors"
                        ><Minus className="w-4 h-4"/></button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded-r-lg transition-colors"
                        ><Plus className="w-4 h-4"/></button>
                      </div>
                      
                      <button onClick={() => removeItem(item.product_id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Selector de Cliente */}
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Cliente</label>
                
                {selectedCustomerId ? (
                  <div className="flex justify-between items-center p-3 border border-indigo-200 bg-indigo-50 rounded-lg">
                    <span className="font-semibold text-indigo-900">
                      {customers.find(c => c.id === selectedCustomerId)?.name || 'Cliente desconocido'}
                    </span>
                    <button 
                      onClick={() => setCustomer('')} 
                      className="text-xs text-indigo-600 font-bold hover:underline bg-indigo-100 px-2 py-1 rounded"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Escribe para buscar un cliente..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 shadow-inner bg-gray-50">
                      {(() => {
                        const userStr = localStorage.getItem('payload-user');
                        const vendorId = userStr ? JSON.parse(userStr).id : null;
                        
                        const filteredCustomers = customers.filter(c => {
                          if (customerSearch) {
                            return c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                   (c.dni && c.dni.includes(customerSearch));
                          } else {
                            // Si no hay búsqueda, mostrar solo los propios del vendedor
                            return String(c.createdBy) === String(vendorId);
                          }
                        });

                        if (filteredCustomers.length === 0) {
                          return <p className="p-3 text-sm text-gray-500 text-center">No se encontraron clientes.</p>;
                        }

                        return filteredCustomers.slice(0, 30).map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => setCustomer(c.id!)}
                            className="p-3 bg-white hover:bg-blue-50 cursor-pointer transition-colors"
                          >
                            <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                            {c.dni && <p className="text-xs text-gray-500">{c.dniType}-{c.dni}</p>}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
                
                {customers.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">Debes crear o descargar clientes primero.</p>
                )}
              </div>

              {/* Total y Checkout */}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total a Pagar</p>
                  <p className="text-2xl font-extrabold text-gray-900">${getTotal().toFixed(2)}</p>
                </div>
                
                <button 
                  onClick={handleCheckout}
                  disabled={items.length === 0 || !selectedCustomerId}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg flex items-center transition-colors shadow-sm"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Crear Pedido
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Órdenes Previas Locales */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Historial de Pedidos Local ({localOrders.length})</h3>
        <ul className="divide-y divide-gray-100">
          {localOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No hay pedidos locales.</p>
          ) : (
            localOrders.map(order => {
              const customer = customers.find(c => String(c.id) === String(order.customer_id));
              return (
                <li key={order.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{customer?.name || 'Cliente desconocido'}</p>
                    <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()} • {order.items.length} items</p>
                    {order.is_credit ? (
                      <span className="text-[10px] px-2 py-1 bg-purple-100 text-purple-800 rounded-full mt-1 inline-block">Crédito</span>
                    ) : (
                      <span className="text-[10px] px-2 py-1 bg-green-100 text-green-800 rounded-full mt-1 inline-block">Contado</span>
                    )}
                  </div>
                  <div className="text-right flex items-center space-x-3">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${order.total.toFixed(2)}</p>
                      {order.sync_status === 'pending' ? (
                        <span className="text-[10px] px-2 py-1 rounded-full inline-block mt-1 bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      ) : (
                        <span 
                          className="text-[10px] px-2 py-1 rounded-full inline-block mt-1 font-medium shadow-sm text-white"
                          style={{ backgroundColor: order.status_color || '#10b981' }}
                        >
                          {order.status_name || 'Sincronizado'}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-1 border-l pl-3 ml-3 border-gray-200">
                      <button 
                        onClick={() => handleWhatsAppShare(order, customer)} 
                        className="p-2 text-green-500 hover:bg-green-50 rounded-full" 
                        title="Enviar por WhatsApp"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      {order.sync_status === 'pending' && (
                        <>
                          <button onClick={() => handleEditOrder(order)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteOrder(order.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-full" title="Eliminar">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Modal de Checkout */}
      {isCheckoutOpen && (
        <CheckoutModal 
          totalUsd={getTotal()} 
          onClose={() => setIsCheckoutOpen(false)} 
          onSubmit={handleCheckoutSubmit} 
        />
      )}
    </div>
  );
};
