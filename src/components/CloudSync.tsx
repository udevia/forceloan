import { CloudDownload, Database, Users, Package, ShoppingCart, Settings, RefreshCw, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../hooks/useSync';

export const CloudSync = () => {
  const { 
    syncProgress, 
    syncCustomers, 
    syncProducts, 
    syncOrders,
    syncSystemData,
    syncAll, 
    clearDeviceCache 
  } = useSync();

  const localProductsCount = useLiveQuery(() => db.products.count()) || 0;
  const localCustomersCount = useLiveQuery(() => db.customers.count()) || 0;
  const localOrdersCount = useLiveQuery(() => db.orders.count()) || 0;
  
  const pendingCustomers = useLiveQuery(() => db.customers.where('sync_status').equals('pending').count()) || 0;
  const pendingOrders = useLiveQuery(() => db.orders.where('sync_status').equals('pending').count()) || 0;

  const isAnySyncing = syncProgress.isSyncingCustomers || syncProgress.isSyncingProducts || syncProgress.isSyncingOrders || syncProgress.isSyncingSystem;

  const renderProgressBar = (progress: number, isSyncing: boolean) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3 overflow-hidden flex">
      <div 
        className={`h-2.5 rounded-full transition-all duration-300 ${isSyncing ? 'bg-indigo-600 animate-pulse' : progress === 100 ? 'bg-emerald-500' : 'bg-gray-400'}`} 
        style={{ width: `${isSyncing ? Math.max(progress, 5) : (progress === 100 ? 100 : 0)}%` }}
      ></div>
    </div>
  );

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <CloudDownload className="mx-auto mb-3 w-10 h-10" />
          <h2 className="font-bold text-2xl mb-2">
            Sincronización Avanzada
          </h2>
          <p className="text-indigo-100 text-sm">
            Gestiona la descarga y envío de información en módulos independientes para una mayor estabilidad.
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          
          {syncProgress.errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm mb-4">
              <p className="font-bold">Error de Sincronización:</p>
              <p className="text-sm">{syncProgress.errorMsg}</p>
            </div>
          )}

          {/* Tarjeta: Clientes */}
          <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Clientes</h3>
                  <p className="text-xs text-gray-500">{localCustomersCount} locales | {pendingCustomers} por subir</p>
                </div>
              </div>
              <button 
                onClick={syncCustomers}
                disabled={isAnySyncing}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-100 disabled:opacity-50 flex items-center"
              >
                {syncProgress.isSyncingCustomers ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CloudDownload className="w-4 h-4 mr-1" />}
                Sync
              </button>
            </div>
            {renderProgressBar(syncProgress.customers, syncProgress.isSyncingCustomers)}
          </div>

          {/* Tarjeta: Productos */}
          <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Productos</h3>
                  <p className="text-xs text-gray-500">{localProductsCount} en catálogo</p>
                </div>
              </div>
              <button 
                onClick={syncProducts}
                disabled={isAnySyncing}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-100 disabled:opacity-50 flex items-center"
              >
                {syncProgress.isSyncingProducts ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CloudDownload className="w-4 h-4 mr-1" />}
                Sync
              </button>
            </div>
            {renderProgressBar(syncProgress.products, syncProgress.isSyncingProducts)}
          </div>

          {/* Tarjeta: Pedidos */}
          <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Pedidos</h3>
                  <p className="text-xs text-gray-500">{localOrdersCount} locales | {pendingOrders} por subir</p>
                </div>
              </div>
              <button 
                onClick={syncOrders}
                disabled={isAnySyncing}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-100 disabled:opacity-50 flex items-center"
              >
                {syncProgress.isSyncingOrders ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CloudDownload className="w-4 h-4 mr-1" />}
                Sync
              </button>
            </div>
            {renderProgressBar(syncProgress.orders, syncProgress.isSyncingOrders)}
          </div>

          {/* Tarjeta: Sistema */}
          <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Tasas y Pagos</h3>
                  <p className="text-xs text-gray-500">Configuración del sistema</p>
                </div>
              </div>
              <button 
                onClick={syncSystemData}
                disabled={isAnySyncing}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-100 disabled:opacity-50 flex items-center"
              >
                {syncProgress.isSyncingSystem ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CloudDownload className="w-4 h-4 mr-1" />}
                Sync
              </button>
            </div>
            {renderProgressBar(syncProgress.system, syncProgress.isSyncingSystem)}
          </div>

          <hr className="my-6 border-gray-200" />

          {/* Botones Globales */}
          <div className="space-y-4">
            <button
              onClick={async () => {
                await syncAll();
                alert('¡Sincronización maestra completada!');
              }}
              disabled={isAnySyncing}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center hover:bg-indigo-700 disabled:opacity-75 transition-all shadow-md text-lg"
            >
              {isAnySyncing ? <RefreshCw className="w-6 h-6 mr-3 animate-spin" /> : <Database className="w-6 h-6 mr-3" />}
              {isAnySyncing ? 'Sincronizando...' : 'Sincronizar Todo Automáticamente'}
            </button>
            
            <button
              onClick={clearDeviceCache}
              disabled={isAnySyncing}
              className="w-full bg-white text-red-600 border border-red-200 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-red-50 disabled:opacity-50 transition-all shadow-sm"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Limpiar Dispositivo (Reset Seguro)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
