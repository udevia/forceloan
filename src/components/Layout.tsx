
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, Package, ShoppingCart, RefreshCw, CheckCircle2, CloudDownload, LogOut } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSync } from '../hooks/useSync';

export const Layout = () => {
  const location = useLocation();
  const { isOnline, isSyncing, triggerSync } = useSync();

  const pendingSyncs = useLiveQuery(
    () => db.customers.where('sync_status').equals('pending').count()
  ) || 0;

  const handleLogout = () => {
    localStorage.removeItem('payload-token');
    localStorage.removeItem('payload-user');
    window.location.href = '/login';
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/productos', icon: Package, label: 'Catálogo' },
    { path: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-16">
      {/* Top Header */}
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
        <h1 className="font-bold text-xl">ForceLoan</h1>
        <div className="flex items-center space-x-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOnline ? 'bg-blue-700' : 'bg-red-500'}`}>
            {isOnline ? 'En línea' : 'Offline'}
          </span>
          
          {/* Botón Descargar Catálogo */}
          <Link to="/cloud-sync" className="disabled:opacity-50 transition-opacity" title="Gestor de Descargas">
            <CloudDownload className="w-5 h-5" />
          </Link>

          {/* Botón Sincronizar Subida */}
          <button onClick={triggerSync} disabled={isSyncing || !isOnline} className="relative disabled:opacity-50 transition-opacity" title="Sincronizar Pendientes">
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : pendingSyncs === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-300" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            
            {pendingSyncs > 0 && !isSyncing && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {pendingSyncs}
              </span>
            )}
          </button>
          
          {/* Logout */}
          <button onClick={handleLogout} className="ml-2 text-blue-200 hover:text-white" title="Cerrar Sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile PWA approach) */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full flex justify-around p-3 pb-safe z-10">
        <Link to="/cloud-sync" className={`flex flex-col items-center space-y-1 ${location.pathname === '/cloud-sync' ? 'text-blue-600' : 'text-gray-500'}`}>
          <CloudDownload className="w-6 h-6" />
          <span className="text-xs font-medium">Sincronizar</span>
        </Link>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center space-y-1 ${
              location.pathname === item.path ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
