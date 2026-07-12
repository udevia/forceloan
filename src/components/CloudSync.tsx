import { CloudDownload, RefreshCw, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../hooks/useSync';

export const CloudSync = () => {
  const { downloadData, isDownloading } = useSync();

  // Estadísticas locales
  const localProductsCount = useLiveQuery(() => db.products.count()) || 0;
  const localCustomersCount = useLiveQuery(() => db.customers.count()) || 0;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <h2 className="font-bold text-xl flex items-center mb-2">
            <CloudDownload className="mr-2 w-6 h-6" />
            Sincronización de Catálogo
          </h2>
          <p className="text-indigo-100">
            Mantén tu dispositivo actualizado con los últimos productos, precios y clientes disponibles desde la oficina central.
          </p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <Database className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-3xl font-black text-gray-800">{localProductsCount}</p>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Productos</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <Database className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-black text-gray-800">{localCustomersCount}</p>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Clientes</p>
            </div>
          </div>

          <button
            onClick={downloadData}
            disabled={isDownloading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center hover:bg-indigo-700 disabled:opacity-75 transition-all shadow-md hover:shadow-lg text-lg"
          >
            <RefreshCw className={`w-6 h-6 mr-3 ${isDownloading ? 'animate-spin' : ''}`} />
            {isDownloading ? 'Sincronizando Catálogo...' : 'Actualizar Datos Ahora'}
          </button>
          
          <p className="text-center text-xs text-gray-400 mt-4">
            Al actualizar, se descargarán los productos asignados para la App y la cartera de clientes.
          </p>
        </div>
      </div>
    </div>
  );
};
