import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { OrderItem } from '../db/db';
import { Trash2, ShoppingBag, Plus, Minus, CheckCircle, Edit, X, Share2 } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';

export const Orders = () => {
  const { items, removeItem, updateQuantity, clearCart, selectedCustomerId, setCustomer } = useCartStore();
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | string | null>(null);
  
  // Listar clientes para el selector
  const queryCustomers = useLiveQuery(() => db.customers.toArray());
  const customers = Array.isArray(queryCustomers) ? queryCustomers : [];
  
  // Listar órdenes previas
  const queryOrders = useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray());
  const localOrders = Array.isArray(queryOrders) ? queryOrders : [];
  
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 1)), 0);
  const taxTotal = safeItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 1)) * ((item?.taxRate ?? 16) / 100), 0);
  const retention = selectedCustomer?.isTaxWithholdingAgent ? taxTotal * 0.75 : 0;
  const finalTotal = subtotal + taxTotal - retention;

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
        subtotal: subtotal,
        taxTotal: taxTotal,
        total: finalTotal,
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
      const phoneText = customer?.phone ? customer.phone.replace(/\D/g, '') : '';
      const orderId = order.id || order.backend_id || 'PENDIENTE';
      const dateStr = new Date(order.created_at || Date.now()).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
      const tipoCondicion = order.is_credit ? 'Realizar pago al llegar despacho' : 'Contado';

      // Construir la lista de productos
      let itemsText = '';
      order.items.forEach((item: any) => {
        const subtotalItem = item.price * item.quantity;
        const itemName = item.name || 'Producto';
        itemsText += `▪️ ${item.quantity}x ${itemName} - *$${subtotalItem.toFixed(2)}*\n`;
      });

      const subtotalMsg = order.subtotal ? `\n\n*Subtotal: $${order.subtotal.toFixed(2)}*\n` : '\n\n';
      const ivaMsg = order.taxTotal ? `*IVA: $${order.taxTotal.toFixed(2)}*\n` : '';
      
      const retention = customer?.isTaxWithholdingAgent && order.taxTotal ? order.taxTotal * 0.75 : 0;
      const retentionMsg = retention > 0 ? `*Retención (75%): -$${retention.toFixed(2)}*\n` : '';

      // Construir el mensaje completo con formato WhatsApp (*negrita*, _cursiva_)
      const textMessage = `*🏢 INVERSIONES LOAN*\n` +
                          `*Resumen de Pedido N° ${orderId}*\n\n` +
                          `👤 *Cliente:* ${customer?.name || 'Consumidor'}\n` +
                          `📅 *Fecha:* ${dateStr}\n` +
                          `💳 *Condición:* ${tipoCondicion}\n\n` +
                          `📦 *DETALLE DE PRODUCTOS:*\n` +
                          `${itemsText}` +
                          `${subtotalMsg}` +
                          `${ivaMsg}` +
                          `${retentionMsg}` +
                          `💰 *TOTAL A PAGAR: $${order.total.toFixed(2)}*\n\n` +
                          `_Pagos en Bs calculados a la tasa Dólar BCV del día del despacho._\n\n` +
                          `⚠️ *Nota administrativa:* Una vez llega el despacho a la puerta, el cliente debe realizar el pago para recibir la mercancía. Sin pago validado, no se procederá a la entrega.\n\n` +
                          `¡Gracias por su compra!`;
      
      // Abrir chat directo en WhatsApp
      const waUrl = `https://wa.me/${phoneText}?text=${encodeURIComponent(textMessage)}`;
      window.open(waUrl, '_blank');
      
    } catch (err) {
      console.error('Error generando mensaje de WhatsApp:', err);
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
          {safeItems.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay productos en el carrito.</p>
          ) : (
            <div className="space-y-4">
              {/* Lista de Items */}
              <ul className="divide-y divide-gray-100">
                {safeItems.map(item => (
                  <li key={item?.product_id} className="py-3 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{item?.name || 'Producto'}</p>
                      <p className="text-blue-600 font-bold">${(item?.price || 0).toFixed(2)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center bg-gray-100 rounded-lg">
                        <button 
                          onClick={() => updateQuantity(item?.product_id, Math.max(1, (item?.quantity || 1) - 1))}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded-l-lg transition-colors"
                        ><Minus className="w-4 h-4"/></button>
                        <span className="w-8 text-center text-sm font-semibold">{item?.quantity || 1}</span>
                        <button 
                          onClick={() => updateQuantity(item?.product_id, (item?.quantity || 1) + 1)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded-r-lg transition-colors"
                        ><Plus className="w-4 h-4"/></button>
                      </div>
                      
                      <button onClick={() => removeItem(item?.product_id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
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
                        let vendorId = null;
                        if (userStr) {
                          try {
                            vendorId = JSON.parse(userStr).id;
                          } catch (e) {
                            console.warn("Invalid payload-user in localStorage");
                          }
                        }
                        
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
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div className="w-full sm:w-auto">
                  <div className="flex justify-between sm:block text-sm text-gray-500 mb-1">
                    <span>Subtotal:</span>
                    <span className="sm:ml-2 font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between sm:block text-sm text-gray-500 mb-1">
                    <span>IVA:</span>
                    <span className="sm:ml-2 font-medium">${taxTotal.toFixed(2)}</span>
                  </div>
                  {retention > 0 && (
                    <div className="flex justify-between sm:block text-sm text-red-500 mb-1">
                      <span>Retención (75%):</span>
                      <span className="sm:ml-2 font-medium">-${retention.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-900 font-bold">Total a Pagar:</span>
                    <span className="text-2xl font-extrabold text-gray-900 sm:ml-2">${finalTotal.toFixed(2)}</span>
                  </div>
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
              const customer = customers.find(c => String(c.id) === String(order?.customer_id));
              const orderItems = Array.isArray(order?.items) ? order.items : [];
              return (
                <li key={order.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{customer?.name || 'Cliente desconocido'}</p>
                    <p className="text-xs text-gray-500">{new Date(order?.created_at || Date.now()).toLocaleString()} • {orderItems.length} items</p>
                    {order?.is_credit ? (
                      <span className="text-[10px] px-2 py-1 bg-purple-100 text-purple-800 rounded-full mt-1 inline-block">Crédito</span>
                    ) : (
                      <span className="text-[10px] px-2 py-1 bg-green-100 text-green-800 rounded-full mt-1 inline-block">Contado</span>
                    )}
                    
                    <button 
                      onClick={() => setExpandedOrderId(expandedOrderId === order?.id ? null : order?.id!)}
                      className="text-xs text-blue-600 hover:underline mt-2 ml-2 font-medium"
                    >
                      {expandedOrderId === order?.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </div>
                  <div className="text-right flex items-center space-x-3 mt-3 sm:mt-0">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${(Number(order?.total) || 0).toFixed(2)}</p>
                      {order?.sync_status === 'pending' ? (
                        <span className="text-[10px] px-2 py-1 rounded-full inline-block mt-1 bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      ) : (
                        <span 
                          className="text-[10px] px-2 py-1 rounded-full inline-block mt-1 font-medium shadow-sm text-white"
                          style={{ backgroundColor: order?.status_color || '#10b981' }}
                        >
                          {order?.status_name || 'Sincronizado'}
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
                      {order?.sync_status === 'pending' && (
                        <>
                          <button onClick={() => handleEditOrder(order)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteOrder(order?.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-full" title="Eliminar">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                  
                  {expandedOrderId === order?.id && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 bg-gray-50 rounded p-3 text-sm">
                      <p className="font-bold text-gray-700 mb-2">Productos:</p>
                      <ul className="space-y-1">
                        {orderItems.map((item: any, idx: number) => (
                          <li key={idx} className="flex justify-between text-gray-600">
                            <span>{item?.quantity || 0}x {item?.name || 'Producto'}</span>
                            <span className="font-semibold">${((item?.price || 0) * (item?.quantity || 1)).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Modal de Checkout */}
      {isCheckoutOpen && (
        <CheckoutModal 
          totalUsd={finalTotal} 
          onClose={() => setIsCheckoutOpen(false)} 
          onSubmit={handleCheckoutSubmit} 
        />
      )}
    </div>
  );
};
