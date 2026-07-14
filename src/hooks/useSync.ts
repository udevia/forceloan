import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { apiClient } from '../api/client';
import { skuCategoryMap } from '../data/categoriesMap';

export type SyncProgress = {
  customers: number;
  products: number;
  orders: number;
  system: number;
  isSyncingCustomers: boolean;
  isSyncingProducts: boolean;
  isSyncingOrders: boolean;
  isSyncingSystem: boolean;
  errorMsg: string | null;
};

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    customers: 0,
    products: 0,
    orders: 0,
    system: 0,
    isSyncingCustomers: false,
    isSyncingProducts: false,
    isSyncingOrders: false,
    isSyncingSystem: false,
    errorMsg: null,
  });

  const updateProgress = (key: keyof SyncProgress, value: any) => {
    setSyncProgress(prev => ({ ...prev, [key]: value }));
  };

  const showError = (msg: string) => {
    updateProgress('errorMsg', msg);
    console.error(msg);
  };

  const clearError = () => {
    updateProgress('errorMsg', null);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      uploadOfflineData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getSellerId = () => {
    const userStr = localStorage.getItem('payload-user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        return userObj.id;
      } catch (e) {}
    }
    return '';
  };

  const base64ToFile = (base64String: string, filename: string): File => {
    const arr = base64String.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || base64String); 
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // --- UPSTREAM ---
  const uploadCustomers = async () => {
    const pendingCustomers = await db.customers.where('sync_status').equals('pending').toArray();
    if (pendingCustomers.length === 0) return true;

    for (const c of pendingCustomers) {
      try {
        const cleanDni = c.dni ? String(c.dni).replace(/\D/g, '') : '0000000'; 
        const uploadedMediaIds: string[] = [];
        if (c.document_images && c.document_images.length > 0) {
          for (let i = 0; i < c.document_images.length; i++) {
            const base64Str = c.document_images[i];
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
          isTaxWithholdingAgent: Boolean(c.isTaxWithholdingAgent),
          createdBy: c.createdBy,
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
        const isLocalId = typeof c.id === 'number' || (typeof c.id === 'string' && c.id.length < 24) || String(c.id).startsWith('local_');

        try {
          if (c.id && !isLocalId) {
            try {
              res = await apiClient.patch(`/users/${c.id}`, payload);
            } catch (e: any) {
              if (e.response?.status === 404) {
                res = await apiClient.post('/users', payload);
              } else {
                throw e;
              }
            }
          } else {
            res = await apiClient.post('/users', payload);
          }
        } catch (postErr: any) {
          const errString = JSON.stringify(postErr.response?.data || postErr.message);
          if (errString.includes('E11000') || errString.includes('duplicate key')) {
            // El cliente ya existe por DNI. Lo buscamos y lo actualizamos.
            const existRes = await apiClient.get(`/users?where[dni][equals]=${cleanDni}`);
            if (existRes.data?.docs && existRes.data.docs.length > 0) {
              const existingUser = existRes.data.docs[0];
              res = await apiClient.patch(`/users/${existingUser.id}`, payload);
              // Notificar al usuario pero sin bloquear
              setTimeout(() => {
                alert(`Nota: El cliente ${c.name} (DNI ${cleanDni}) ya estaba registrado en el sistema. Se ha actualizado su información localmente.`);
              }, 100);
            } else {
              throw postErr;
            }
          } else {
            throw postErr;
          }
        }
        
        if (res.status === 201 || res.status === 200) {
          const backendId = res.data.doc.id;
          await db.customers.delete(c.id!);
          await db.customers.add({ ...c, id: backendId, sync_status: 'synced' });
          
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
        showError(`Error al subir el cliente ${c.name}: ${errorMsg}`);
      }
    }
    return true;
  };

  const uploadOrders = async () => {
    const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();
    if (pendingOrders.length === 0) return true;

    const activeExchange = await db.exchange.toArray();
    const exchangeId = activeExchange.length > 0 ? activeExchange[0].id : undefined;

    let newStatusId = undefined;
    try {
      const statusRes = await apiClient.get('/status-orders?limit=100');
      if (statusRes.status === 200 && statusRes.data.docs) {
        const statuses = statusRes.data.docs;
        const target = statuses.find((s: any) => s.name?.toLowerCase().includes('nuevo') || s.name?.toLowerCase().includes('nueva') || s.name?.toLowerCase().includes('pendiente'));
        if (target) newStatusId = target.id;
      }
    } catch (err) {}

    for (const o of pendingOrders) {
      try {
        let bankInfoToUpload = o.bank_info || [];
        
        if (bankInfoToUpload.length > 0) {
          const updatedBankInfo = [];
          for (const bi of bankInfoToUpload) {
            let receiptId = undefined;
            if (bi.receiptBase64) {
              try {
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
          user: o.customer_id,
          products: o.items.map(i => ({ 
            product: [i.product_id], 
            quantity: String(i.quantity), 
            price: String(i.price) 
          })),
          total: String(o.total),
          taxTotal: o.taxTotal ? String(o.taxTotal) : undefined,
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
           showError('El backend rechazó el pedido. Razón: ' + errorMsg);
        } else {
           showError('Error de conexión o timeout al subir el pedido.');
        }
      }
    }
    return true;
  };

  const backupToCloud = async () => {
    try {
      const sellerId = getSellerId();
      if (!sellerId) return;
      
      const allCustomers = await db.customers.toArray();
      const allOrders = await db.orders.toArray();
      
      const backupPayload = {
        vendedor: sellerId,
        customersData: allCustomers,
        ordersData: allOrders
      };
      
      const backupRes = await apiClient.get(`/seller-backups?where[vendedor][equals]=${sellerId}`);
      if (backupRes.status === 200 && backupRes.data.docs && backupRes.data.docs.length > 0) {
        const backupId = backupRes.data.docs[0].id;
        await apiClient.patch(`/seller-backups/${backupId}`, backupPayload);
      } else {
        await apiClient.post('/seller-backups', backupPayload);
      }
    } catch (backupErr) {
      console.error('Error al realizar el respaldo:', backupErr);
    }
  };

  const uploadOfflineData = async () => {
    if (!navigator.onLine) return;
    await uploadCustomers();
    await uploadOrders();
    await backupToCloud();
  };

  // --- MODULAR SYNC ---
  const syncCustomers = async () => {
    if (!navigator.onLine) { showError('Sin conexión.'); return; }
    clearError();
    updateProgress('isSyncingCustomers', true);
    updateProgress('customers', 0);
    
    try {
      await uploadCustomers();
      
      let hasNextPage = true;
      let page = 1;
      let allValidCustomers: any[] = [];
      const offlineCustomers = await db.customers.where('sync_status').equals('pending').toArray();
      const sellerId = getSellerId();
      const filterQuery = sellerId ? `&where[createdBy.value][equals]=${sellerId}` : '';

      while (hasNextPage) {
        const usersRes = await apiClient.get(`/users?limit=100&page=${page}${filterQuery}`); 
        if (usersRes.status === 200) {
          const { docs, totalPages } = usersRes.data;
          
          const validCustomers = docs
          .filter((u: any) => u.dni && u.name)
          .map((u: any) => {
            let createdById = undefined;
            if (u.createdBy) {
              if (u.createdBy.value) {
                createdById = typeof u.createdBy.value === 'object' ? (u.createdBy.value.id || u.createdBy.value._id) : u.createdBy.value;
              } else if (typeof u.createdBy === 'object') {
                createdById = u.createdBy.id || u.createdBy._id;
              } else {
                createdById = u.createdBy;
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
              gps_location: u.gps_location,
              document_images: u.document_images?.map((d: any) => d.image?.id || d.image || d),
              isTaxWithholdingAgent: u.isTaxWithholdingAgent,
              createdBy: createdById,
              sync_status: 'synced',
              created_at: Date.now()
            };
          });
          allValidCustomers = [...allValidCustomers, ...validCustomers];
          
          hasNextPage = usersRes.data.hasNextPage;
          page++;
          updateProgress('customers', Math.round(((page - 1) / (totalPages || 1)) * 100));
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
        
        const uniqueFinalCustomersMap = new Map();
        finalCustomers.forEach(c => uniqueFinalCustomersMap.set(c.id, c));
        const deduplicatedFinal = Array.from(uniqueFinalCustomersMap.values());

        await db.transaction('rw', db.customers, async () => {
          await db.customers.clear();
          const allToPut = [...deduplicatedFinal, ...offlineCustomers];
          const chunkSize = 250;
          for (let i = 0; i < allToPut.length; i += chunkSize) {
            await db.customers.bulkPut(allToPut.slice(i, i + chunkSize));
          }
        });
      }
      updateProgress('customers', 100);
    } catch (err: any) {
      console.error('Error en syncCustomers', err);
      const backendErr = err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : (err.response?.data?.message || err.message);
      showError('Error en clientes: ' + backendErr);
    } finally {
      setTimeout(() => updateProgress('isSyncingCustomers', false), 1000);
    }
  };

  const syncProducts = async () => {
    if (!navigator.onLine) { showError('Sin conexión.'); return; }
    clearError();
    updateProgress('isSyncingProducts', true);
    updateProgress('products', 0);
    
    try {
      let hasNextPage = true;
      let page = 1;
      let allProducts: any[] = [];
      
      while (hasNextPage) {
        const productsRes = await apiClient.get(`/productos?where[and][0][stockMain][greater_than]=0&where[and][1][inventoryStatus][equals]=active&limit=100&page=${page}&depth=1`);
        if (productsRes.status === 200) {
          const { docs, totalPages } = productsRes.data;
          const products = docs.map((p: any) => {
            const imgObj = p.images?.[0]?.image;
            let finalUrl = '';
            if (imgObj) {
              const urlToUse = imgObj.sizes?.thumbnail?.url || imgObj.sizes?.small?.url || imgObj.url;
              if (urlToUse) {
                finalUrl = urlToUse.startsWith('http') ? urlToUse : `https://galpon.loanmayorista.site${urlToUse}`;
              }
            }
            return {
              id: p.id,
              name: p.title || p.name,
              sku: p.sku || p.id,
              price: p.price || 0,
              taxRate: typeof p.tax === 'number' ? p.tax : (p.taxCategory?.rate ?? 16),
              stock: p.stockMain || 0,
              category: skuCategoryMap[p.sku || p.id] || 'Otras Categorías',
              image_url: finalUrl,
              last_updated: Date.now()
            };
          });
          allProducts = [...allProducts, ...products];
          
          hasNextPage = productsRes.data.hasNextPage;
          page++;
          updateProgress('products', Math.round(((page - 1) / (totalPages || 1)) * 100));
        } else {
          hasNextPage = false;
        }
      }

      await db.products.clear();
      if (allProducts.length > 0) {
        // Chunk inserts to avoid QuotaExceededError in mobile Safari due to transaction limits
        const chunkSize = 250;
        for (let i = 0; i < allProducts.length; i += chunkSize) {
          await db.products.bulkPut(allProducts.slice(i, i + chunkSize));
        }

        // Cacheo en segundo plano muy lento para no ahogar la memoria del móvil
        const imageUrls = allProducts.map((p: any) => p.image_url).filter(Boolean);
        setTimeout(async () => {
           for (const url of imageUrls) {
               await fetch(url, { mode: 'no-cors' }).catch(() => {});
               // 150ms de pausa entre cada imagen = 2.5 minutos para 1000 imagenes. ¡Seguro para la memoria!
               await new Promise(r => setTimeout(r, 150)); 
           }
        }, 1000);
      }
      updateProgress('products', 100);
    } catch (err: any) {
      console.error('Error en syncProducts', err);
      showError('Error en productos: ' + (err.message || 'Error desconocido'));
    } finally {
      setTimeout(() => updateProgress('isSyncingProducts', false), 1000);
    }
  };

  const syncOrders = async () => {
    if (!navigator.onLine) { showError('Sin conexión.'); return; }
    clearError();
    updateProgress('isSyncingOrders', true);
    updateProgress('orders', 0);
    
    try {
      await uploadOrders();
      updateProgress('orders', 25);
      
      let hasNextPage = true;
      let page = 1;
      let allBackendOrders: any[] = [];
      const sellerId = getSellerId();
      
      if (sellerId) {
        while (hasNextPage) {
          const ordersRes = await apiClient.get(`/ordenes?where[createdBy.value][equals]=${sellerId}&limit=50&page=${page}&depth=1`);
          if (ordersRes.status === 200) {
            const { docs, totalPages } = ordersRes.data;
            allBackendOrders = [...allBackendOrders, ...docs];
            hasNextPage = ordersRes.data.hasNextPage;
            page++;
            updateProgress('orders', 25 + Math.round(((page - 1) / (totalPages || 1)) * 75));
          } else {
            hasNextPage = false;
          }
        }
        
        if (allBackendOrders.length > 0) {
          for (const bOrder of allBackendOrders) {
            const existingLocal = await db.orders.where('backend_id').equals(bOrder.id).first();
            if (existingLocal) {
              await db.orders.update(Number(existingLocal.id!), {
                status_name: bOrder.status?.name || 'Recibido',
                status_color: bOrder.status?.color || '#10b981'
              });
            } else {
              const customerId = typeof bOrder.user === 'object' ? bOrder.user?.id : bOrder.user;
              if (customerId) {
                await db.orders.add({
                  backend_id: bOrder.id,
                  customer_id: customerId,
                  items: bOrder.products?.map((p: any) => {
                    const prodRef = Array.isArray(p.product) ? p.product[0] : p.product;
                    return {
                      product_id: typeof prodRef === 'object' ? (prodRef?.id || prodRef?._id) : prodRef,
                      name: typeof prodRef === 'object' ? (prodRef?.title || prodRef?.name || 'Producto') : 'Producto',
                      quantity: Number(p.quantity),
                      price: Number(p.price)
                    };
                  }) || [],
                  subtotal: Number(bOrder.total) - Number(bOrder.taxTotal || 0),
                  taxTotal: Number(bOrder.taxTotal || 0),
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
        }
      }
      updateProgress('orders', 100);
      await backupToCloud();
    } catch (err: any) {
      console.error('Error en syncOrders', err);
      showError('Error en pedidos: ' + (err.message || 'Error desconocido'));
    } finally {
      setTimeout(() => updateProgress('isSyncingOrders', false), 1000);
    }
  };

  const syncSystemData = async () => {
    if (!navigator.onLine) { showError('Sin conexión.'); return; }
    clearError();
    updateProgress('isSyncingSystem', true);
    updateProgress('system', 0);
    
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
      }
      updateProgress('system', 50);

      const exchangeRes = await apiClient.get('/exchange?where[is_active][equals]=true&limit=1');
      if (exchangeRes.status === 200 && exchangeRes.data.docs.length > 0) {
        const activeEx = exchangeRes.data.docs[0];
        await db.exchange.clear();
        await db.exchange.put({
          id: activeEx.id,
          price: Number(typeof activeEx.price === 'string' ? activeEx.price.replace(',', '.') : activeEx.price),
          specialPrice: activeEx.specialPrice ? Number(typeof activeEx.specialPrice === 'string' ? activeEx.specialPrice.replace(',', '.') : activeEx.specialPrice) : undefined
        });
      }
      updateProgress('system', 100);
    } catch (err: any) {
      console.error('Error en syncSystemData', err);
      const backendErr = err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : (err.response?.data?.message || err.message);
      showError('Error en sistema: ' + backendErr);
    } finally {
      setTimeout(() => updateProgress('isSyncingSystem', false), 1000);
    }
  };

  const syncAll = async () => {
    if (!navigator.onLine) { showError('Sin conexión.'); return; }
    clearError();
    await syncSystemData();
    await syncCustomers();
    await syncProducts();
    await syncOrders();
  };

  const clearDeviceCache = async () => {
    const isConfirmed = window.confirm(
      "¡ADVERTENCIA! Vas a borrar TODOS los datos locales de tu dispositivo (excepto tu sesión).\n\n" +
      "Los pedidos y clientes 'pendientes' (offline) que no hayas sincronizado se perderán IRREMEDIABLEMENTE.\n\n" +
      "¿Estás ABSOLUTAMENTE seguro de que quieres limpiar la aplicación?"
    );

    if (!isConfirmed) return;

    try {
      await db.customers.clear();
      await db.products.clear();
      await db.orders.clear();
      await db.paymentMethods.clear();
      await db.exchange.clear();
      
      alert("Base de datos local eliminada con éxito. La aplicación se recargará para asegurar un estado limpio.");
      window.location.reload();
    } catch (e) {
      console.error('Error limpiando caché local:', e);
      alert('Error al limpiar los datos locales.');
    }
  };

  const triggerSync = uploadOfflineData;
  const downloadData = syncAll;
  const isDownloading = syncProgress.isSyncingCustomers || syncProgress.isSyncingProducts || syncProgress.isSyncingOrders || syncProgress.isSyncingSystem;
  const isSyncing = isDownloading;

  return { 
    isOnline, 
    isSyncing, 
    isDownloading, 
    triggerSync, 
    downloadData,
    syncProgress,
    syncCustomers,
    syncProducts,
    syncOrders,
    syncSystemData,
    syncAll,
    clearDeviceCache
  };
};
