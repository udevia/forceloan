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
    console.log('Descargando clientes...');

    try {
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
          const productsRes = await apiClient.get(`/productos?where[availableForApp][equals]=true&limit=1000&page=${page}`);
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

      alert('¡Sincronización descendente completada exitosamente!');
    } catch (error) {
      console.error('Error descargando clientes:', error);
      alert('Hubo un error al actualizar los clientes. Asegúrate de que el backend tenga los permisos actualizados.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Upstream: Subir datos offline al servidor
  const triggerSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    console.log('Iniciando sincronización diferida (Upstream)...');

    try {
      const pendingCustomers = await db.customers.where('sync_status').equals('pending').toArray();
      const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();

      if (pendingCustomers.length === 0 && pendingOrders.length === 0) {
        setIsSyncing(false);
        return;
      }

      // 1. Subir Clientes
      for (const c of pendingCustomers) {
        try {
          const payload = {
            name: c.name,
            dni: c.dni,
            dniType: c.dniType || 'V',
            email: c.email || `${Date.now()}@temp.com`,
            phone: c.phone,
            password: 'temporal_password',
          };

          let res;
          if (typeof c.id === 'string') {
            // Editando cliente ya existente en el backend
            res = await apiClient.patch(`/users/${c.id}`, payload);
          } else {
            // Cliente completamente nuevo local
            res = await apiClient.post('/users', payload);
          }
          
          if (res.status === 201 || res.status === 200) {
            await db.customers.update(c.id!, { 
              id: res.data.doc.id, // Si era nuevo, se actualiza al ID string
              sync_status: 'synced' 
            });
          }
        } catch (e) {
          console.error('Error subiendo cliente:', e);
        }
      }

      // 2. Subir Pedidos
      const activeExchange = await db.exchange.toArray();
      const exchangeId = activeExchange.length > 0 ? activeExchange[0].id : undefined;

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
                amount: bi.amount,
                paymentGateway: bi.paymentGateway,
                ...(receiptId && { receipt: receiptId })
              });
            }
            bankInfoToUpload = updatedBankInfo;
          }

          const res = await apiClient.post('/ordenes', {
            user: o.customer_id, // ID del cliente
            products: o.items.map(i => ({ product: i.product_id, quantity: i.quantity, price: i.price })),
            total: o.total,
            totalBs: o.totalBs,
            exchange: exchangeId,
            exchangeRate: o.exchangeRate,
            isCredit: o.is_credit,
            bankInfo: bankInfoToUpload,
            paymentCash: o.payment_cash || [],
            status: 'pending', // Payload status Orders
          });
          
          if (res.status === 201 || res.status === 200) {
            await db.orders.update(Number(o.id), { sync_status: 'synced' });
          }
        } catch (e) {
          console.error('Error subiendo pedido:', e);
        }
      }
      
      console.log('Sincronización Upstream finalizada.');
    } catch (error) {
      console.error('Error general durante la sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, isDownloading, triggerSync, downloadData };
};
