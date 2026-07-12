import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { apiClient } from '../api/client';

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Downstream: Descargar clientes del backend a Dexie
  const downloadData = async () => {
    if (!navigator.onLine) {
      alert('Necesitas conexión para descargar clientes.');
      return;
    }
    
    setIsDownloading(true);
    console.log('Descargando datos...');

    try {
      // 0. Subir clientes y pedidos pendientes ANTES de descargar
      await triggerSync();

      // 1. Bajar clientes
      try {
        let hasNextPage = true;
        let page = 1;
        let allValidCustomers: any[] = [];
        
        const offlineCustomers = await db.customers.where('sync_status').equals('pending').toArray();

        while (hasNextPage) {
          const usersRes = await apiClient.get(`/users?limit=1000&page=${page}`); 
          if (usersRes.status === 200) {
            const users = usersRes.data.docs;
              const validCustomers = users
              .filter((u: any) => u.dni && u.name)
              .map((u: any) => {
                let createdById = undefined;
                if (u.createdBy) {
                  if (typeof u.createdBy.value === 'object' && u.createdBy.value !== null) {
                    createdById = u.createdBy.value.id || u.createdBy.value._id;
                  } else {
                    createdById = u.createdBy.value || u.createdBy;
                  }
                }
                return {
                  id: u.id,
                  name: u.name,
                  dni: u.dni,
                  dniType: u.dniType || 'V',
                  email: u.email,
                  phone: u.phone,
                  address: u.address || '',
                  createdBy: createdById,
                  sync_status: 'synced',
                  created_at: Date.now()
                };
              });
            allValidCustomers = [...allValidCustomers, ...validCustomers];
            
            hasNextPage = usersRes.data.hasNextPage;
            page++;
          } else {
            hasNextPage = false;
          }
        }

        if (allValidCustomers.length > 0) {
          const localCustomers = await db.customers.toArray();
          const localMap = new Map(localCustomers.map(c => [c.id, c]));

          const mergedCustomers = allValidCustomers.map(c => {
            const local = localMap.get(c.id);
            if (local) {
              return {
                ...c,
                gps_location: local.gps_location,
                document_images: local.document_images,
              };
            }
            return c;
          });

          const pendingIds = new Set(offlineCustomers.map(c => c.id));
          const finalCustomers = mergedCustomers.filter(c => !pendingIds.has(c.id));
          
          // Eliminar cualquier posible duplicado por ID que venga de la paginación del API
          const uniqueFinalCustomersMap = new Map();
          finalCustomers.forEach(c => uniqueFinalCustomersMap.set(c.id, c));
          const deduplicatedFinal = Array.from(uniqueFinalCustomersMap.values());

          await db.customers.clear();
          await db.customers.bulkAdd([...deduplicatedFinal, ...offlineCustomers]);
          console.log(`${deduplicatedFinal.length} clientes descargados y guardados exitosamente.`);
        }
      } catch (err) {
        console.error('Error bajando clientes:', err);
      }

      // 2. Descargar métodos de pago activos
      try {
        const paymentsRes = await apiClient.get('/paymentsGateway?where[isActive][equals]=true&limit=100');
        if (paymentsRes.status === 200) {
          const payments = paymentsRes.data.docs.map((p: any) => ({
            id: p.id,
            name: p.name,
            requiresBankInfo: p.requiresBankInfo,
            requiresBills: p.requiresBills
          }));
          await db.paymentMethods.clear();
          await db.paymentMethods.bulkAdd(payments);
          console.log(`${payments.length} métodos de pago descargados.`);
        }
      } catch (err) {
        console.error('Error bajando métodos de pago:', err);
      }

      // 3. Descargar tasa de cambio activa
      try {
        const exchangeRes = await apiClient.get('/exchange?where[is_active][equals]=true&limit=1');
        if (exchangeRes.status === 200 && exchangeRes.data.docs.length > 0) {
          const activeEx = exchangeRes.data.docs[0];
          await db.exchange.clear();
          await db.exchange.put({
            id: activeEx.id,
            price: Number(typeof activeEx.price === 'string' ? activeEx.price.replace(',', '.') : activeEx.price),
            specialPrice: activeEx.specialPrice ? Number(typeof activeEx.specialPrice === 'string' ? activeEx.specialPrice.replace(',', '.') : activeEx.specialPrice) : undefined
          });
          console.log(`Tasa de cambio descargada.`);
        }
      } catch (err) {
        console.error('Error bajando tasa de cambio:', err);
      }

      // 4. Descargar productos disponibles para la app
      try {
        let hasNextPage = true;
        let page = 1;
        let allProducts: any[] = [];
        
        while (hasNextPage) {
          const productsRes = await apiClient.get(`/productos?where[and][0][availableForApp][equals]=true&where[and][1][inventoryStatus][equals]=active&limit=1000&page=${page}`);
          if (productsRes.status === 200) {
            const products = productsRes.data.docs.map((p: any) => ({
              id: p.id,
              name: p.title || p.name,
              sku: p.sku || p.id,
              price: p.price || 0,
              stock: p.stockMain || 0,
              image_url: p.images?.[0]?.image?.url ? 
                (p.images[0].image.url.startsWith('http') ? p.images[0].image.url : `https://galpon.loanmayorista.site${p.images[0].image.url}`) 
                : '',
              last_updated: Date.now()
            }));
            allProducts = [...allProducts, ...products];
            
            hasNextPage = productsRes.data.hasNextPage;
            page++;
          } else {
            hasNextPage = false;
          }
        }

        await db.products.clear();
        if (allProducts.length > 0) {
          await db.products.bulkAdd(allProducts);
          console.log(`${allProducts.length} productos descargados.`);
          
          // Forzar la descarga de las imágenes en segundo plano paulatinamente para no congelar el Service Worker
          const imageUrls = allProducts.map((p: any) => p.image_url).filter(Boolean);
          setTimeout(async () => {
             for (const url of imageUrls) {
                 await fetch(url, { mode: 'no-cors' }).catch(() => {});
                 // Pequeño descanso de 50ms entre cada imagen para no colapsar la red
                 await new Promise(r => setTimeout(r, 50));
             }
          }, 100);
        } else {
          console.log(`No hay productos disponibles para la app. Catálogo local vaciado.`);
        }
      } catch (err) {
        console.error('Error bajando productos:', err);
      }

      // 5. Descargar estados de pedidos / Historial de Pedidos del Vendedor
      try {
        let hasNextPage = true;
        let page = 1;
        let allBackendOrders: any[] = [];
        const userStr = localStorage.getItem('payload-user');
        const userObj = userStr ? JSON.parse(userStr) : null;
        
        if (userObj && userObj.id) {
          while (hasNextPage) {
            const ordersRes = await apiClient.get(`/ordenes?where[createdBy][equals]=${userObj.id}&limit=100&page=${page}`);
            if (ordersRes.status === 200) {
              allBackendOrders = [...allBackendOrders, ...ordersRes.data.docs];
              hasNextPage = ordersRes.data.hasNextPage;
              page++;
            } else {
              hasNextPage = false;
            }
          }
          
          if (allBackendOrders.length > 0) {
            for (const bOrder of allBackendOrders) {
              const existingLocal = await db.orders.where('backend_id').equals(bOrder.id).first();
              if (existingLocal) {
                // Actualizar estado
                await db.orders.update(Number(existingLocal.id!), {
                  status_name: bOrder.status?.name || 'Recibido',
                  status_color: bOrder.status?.color || '#10b981'
                });
              } else {
                // Reconstruir pedido en formato Dexie (Backups secundarios o dispositivos nuevos)
                const customerId = typeof bOrder.user === 'object' ? bOrder.user?.id : bOrder.user;
                
                if (customerId) {
                  await db.orders.add({
                    backend_id: bOrder.id,
                    customer_id: customerId,
                    items: bOrder.products?.map((p: any) => ({
                      product_id: Array.isArray(p.product) ? (p.product[0]?.id || p.product[0]) : p.product,
                      name: Array.isArray(p.product) ? (p.product[0]?.title || p.product[0]?.name || 'Producto') : 'Producto',
                      quantity: Number(p.quantity),
                      price: Number(p.price)
                    })) || [],
                    total: Number(bOrder.total),
                    totalBs: Number(bOrder.totalBs || 0),
                    exchangeRate: Number(bOrder.exchangeRate || 0),
                    is_credit: Boolean(bOrder.isCredit),
                    sync_status: 'synced',
                    status_name: bOrder.status?.name || 'Recibido',
                    status_color: bOrder.status?.color || '#10b981',
                    created_at: new Date(bOrder.createdAt).getTime()
                  });
                }
              }
            }
            console.log(`Estados actualizados y/o reconstruidos de ${allBackendOrders.length} pedidos históricos.`);
          }
        }
      } catch (err) {
        console.error('Error bajando historial de pedidos:', err);
      }

      alert('¡Sincronización descendente completada exitosamente!');
    } catch (error) {
      console.error('Error descargando clientes:', error);
      alert('Hubo un error al actualizar los clientes. Asegúrate de que el backend tenga los permisos actualizados.');
    } finally {
      setIsDownloading(false);
    }
  };
  const base64ToFile = (base64String: string, filename: string): File => {
    const arr = base64String.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || base64String); // Fallback por si no tiene header
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Upstream: Subir datos offline al servidor
  const triggerSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    console.log('Iniciando sincronización diferida (Upstream)...');

    try {
      const pendingCustomers = await db.customers.where('sync_status').equals('pending').toArray();

      // 1. Subir Clientes
      for (const c of pendingCustomers) {
        try {
          const cleanDni = c.dni.replace(/\D/g, ''); // Remover cualquier caracter no numérico
          
          // Subir imágenes si existen
          const uploadedMediaIds: string[] = [];
          if (c.document_images && c.document_images.length > 0) {
            for (let i = 0; i < c.document_images.length; i++) {
              const base64Str = c.document_images[i];
              // Evitar intentar subir si ya es un ID de Payload
              if (!base64Str.startsWith('data:image')) {
                uploadedMediaIds.push(base64Str);
                continue;
              }
              
              try {
                const file = base64ToFile(base64Str, `doc_${cleanDni}_${i}.jpg`);
                const formData = new FormData();
                formData.append('file', file);
                formData.append('alt', `Documento Cliente ${cleanDni}`);
                
                const mediaRes = await apiClient.post('/media', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                if (mediaRes.status === 201) {
                  uploadedMediaIds.push(mediaRes.data.doc.id);
                }
              } catch (mediaErr) {
                console.error(`Error subiendo imagen ${i} de documento:`, mediaErr);
              }
            }
          }
          
          const payload: any = {
            name: c.name,
            dni: cleanDni,
            dniType: c.dniType || 'V',
            email: c.email || `${Date.now()}@temp.com`,
            phone: c.phone || '0000000000',
            password: 'temporal_password',
          };

          if (c.gps_location) {
            payload.gps_location = {
              lat: Number(c.gps_location.lat),
              lng: Number(c.gps_location.lng)
            };
          }
          
          if (uploadedMediaIds.length > 0) {
            payload.document_images = uploadedMediaIds.map(id => ({ image: id }));
          }

          let res;
          if (typeof c.id === 'string') {
            // Editando cliente ya existente en el backend
            res = await apiClient.patch(`/users/${c.id}`, payload);
          } else {
            // Cliente completamente nuevo local
            res = await apiClient.post('/users', payload);
          }
          
          if (res.status === 201 || res.status === 200) {
            const backendId = res.data.doc.id;
            
            // Dexie no permite cambiar la clave primaria directamente, así que borramos y recreamos
            await db.customers.delete(c.id!);
            await db.customers.add({ ...c, id: backendId, sync_status: 'synced' });
            
            // Actualizar todos los pedidos locales que hacían referencia al ID numérico temporal
            const ordersToUpdate = await db.orders.where('customer_id').equals(c.id!).toArray();
            for (const order of ordersToUpdate) {
              await db.orders.update(Number(order.id!), { customer_id: backendId });
            }
          }
        } catch (e: any) {
          console.error('Error subiendo cliente:', e);
          const errorMsg = e.response?.data?.errors 
            ? JSON.stringify(e.response.data.errors) 
            : (e.response?.data?.message || e.message);
          alert(`Error al subir el cliente ${c.name}: ${errorMsg}`);
        }
      }

      // 2. Subir Pedidos
      // Consultamos los pedidos pendientes DESPUÉS de subir clientes para tener los customer_id actualizados
      const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();
      const activeExchange = await db.exchange.toArray();
      const exchangeId = activeExchange.length > 0 ? activeExchange[0].id : undefined;

      // Buscar el ID del estatus "Nuevo"
      let newStatusId = undefined;
      try {
        const statusRes = await apiClient.get('/status-orders?limit=100');
        if (statusRes.status === 200 && statusRes.data.docs) {
          const statuses = statusRes.data.docs;
          const target = statuses.find((s: any) => s.name?.toLowerCase().includes('nuevo') || s.name?.toLowerCase().includes('nueva') || s.name?.toLowerCase().includes('pendiente'));
          if (target) newStatusId = target.id;
        }
      } catch (err) {
        console.error('No se pudo cargar la lista de estados:', err);
      }

      for (const o of pendingOrders) {
        try {
          // Procesar recibos si hay pagos bancarios
          let bankInfoToUpload = o.bank_info || [];
          
          if (bankInfoToUpload.length > 0) {
            const updatedBankInfo = [];
            for (const bi of bankInfoToUpload) {
              let receiptId = undefined;
              if (bi.receiptBase64) {
                try {
                  // Convertir Base64 a File
                  const res = await fetch(bi.receiptBase64);
                  const blob = await res.blob();
                  const file = new File([blob], `comprobante_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
                  
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('alt', `Recibo de pago - Ref ${bi.transaction}`);
                  formData.append('documentType', 'payment');
                  
                  const uploadRes = await apiClient.post('/financial-docs', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  });
                  receiptId = uploadRes.data.doc.id;
                } catch (imgErr) {
                  console.error('Error subiendo comprobante:', imgErr);
                }
              }
              
              updatedBankInfo.push({
                transaction: bi.transaction,
                transmitter: bi.transmitter,
                amount: Number(bi.amount),
                paymentGateway: bi.paymentGateway,
                ...(receiptId && { receipt: receiptId })
              });
            }
            bankInfoToUpload = updatedBankInfo;
          }

          const orderPayload: any = {
            user: o.customer_id, // Ahora es un ID válido del backend
            products: o.items.map(i => ({ 
              product: [i.product_id], // Payload hasMany: true requiere un array de IDs
              quantity: String(i.quantity), 
              price: String(i.price) 
            })),
            total: String(o.total),
            totalBs: String(o.totalBs),
            exchange: exchangeId,
            exchangeRate: Number(o.exchangeRate),
            isCredit: Boolean(o.is_credit),
            bankInfo: bankInfoToUpload,
            paymentCash: o.payment_cash || [],
          };

          if (newStatusId) {
            orderPayload.status = newStatusId;
          }

          const res = await apiClient.post('/ordenes', orderPayload);
          
          if (res.status === 201 || res.status === 200) {
            await db.orders.update(Number(o.id), { 
              sync_status: 'synced',
              backend_id: res.data.doc.id,
              status_name: res.data.doc.status?.name || 'Nuevo',
              status_color: res.data.doc.status?.color || '#10b981'
            });
          }
        } catch (e: any) {
          console.error('Error subiendo pedido:', e);
          if (e.response && e.response.data) {
             const errorMsg = JSON.stringify(e.response.data.errors || e.response.data);
             console.error('Detalles del backend:', errorMsg);
             alert('El backend rechazó el pedido. Razón: ' + errorMsg);
          } else {
             alert('Error de conexión o timeout al subir el pedido.');
          }
        }
      }
      
      console.log('Sincronización Upstream finalizada. Realizando copia de seguridad en la nube...');
      try {
        const userStr = localStorage.getItem('payload-user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          if (userObj && userObj.id) {
            const allCustomers = await db.customers.toArray();
            const allOrders = await db.orders.toArray();
            
            const backupPayload = {
              vendedor: userObj.id,
              customersData: allCustomers,
              ordersData: allOrders
            };
            
            // Buscar si ya existe un respaldo
            const backupRes = await apiClient.get(`/seller-backups?where[vendedor][equals]=${userObj.id}`);
            if (backupRes.status === 200 && backupRes.data.docs && backupRes.data.docs.length > 0) {
              const backupId = backupRes.data.docs[0].id;
              await apiClient.patch(`/seller-backups/${backupId}`, backupPayload);
            } else {
              await apiClient.post('/seller-backups', backupPayload);
            }
            console.log('Respaldo en la nube completado exitosamente.');
          }
        }
      } catch (backupErr) {
        console.error('Error al realizar el respaldo en la nube:', backupErr);
      }
    } catch (error) {
      console.error('Error general durante la sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, isDownloading, triggerSync, downloadData };
};
