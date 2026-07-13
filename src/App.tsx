import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CustomerForm } from './components/CustomerForm';
import { Login } from './components/Login';
import { Catalog } from './components/Catalog';
import { Orders } from './components/Orders';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';

import { CloudSync } from './components/CloudSync';

const Home = () => <div className="p-4"><h2 className="text-xl font-bold mb-4">Resumen</h2><p>Bienvenido a ForceLoan. Estás listo para vender.</p></div>;

// Componente de Clientes omitido por brevedad (ya está en el archivo, se mantendrá sin cambios al hacer el replace a nivel de componente general, espera, no, esto va a pisar Customers).

// Es mejor hacer el replace solo de los import y de la lista de rutas.

const Customers = () => {
  const localCustomersCount = useLiveQuery(() => db.customers.count()) || 0;
  let currentUser: any = {};
  try {
    currentUser = JSON.parse(localStorage.getItem('payload-user') || '{}');
  } catch (e) {
    console.warn('Error parsing payload-user');
  }
  
  const myCustomers = useLiveQuery(
    () => db.customers.filter(c => c.createdBy === currentUser.id || c.sync_status === 'pending').toArray()
  );

  const [editingCustomer, setEditingCustomer] = React.useState<any>(null);

  return (
    <div className="space-y-6">
      {editingCustomer ? (
        <CustomerForm 
          key={`edit-${editingCustomer.id}`}
          initialData={editingCustomer} 
          onCancel={() => setEditingCustomer(null)} 
        />
      ) : (
        <CustomerForm key="new" />
      )}
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Total Clientes Sincronizados</h3>
        <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">
          {localCustomersCount}
        </span>
      </div>

      {myCustomers && myCustomers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Mis Clientes</h3>
            <span className="text-sm text-gray-500">{myCustomers.length} registrados por ti</span>
          </div>
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {myCustomers.map((c: any) => (
              <li key={c.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.dniType}-{c.dni} • {c.phone}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {c.sync_status === 'pending' && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Pendiente
                    </span>
                  )}
                  <button 
                    onClick={() => {
                      setEditingCustomer(c);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-blue-600 hover:bg-blue-50 px-3 py-1 text-sm border border-blue-200 rounded transition-colors"
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Componente para proteger las rutas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('payload-token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="clientes" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
          <Route path="productos" element={<ErrorBoundary><Catalog /></ErrorBoundary>} />
          <Route path="pedidos" element={<ErrorBoundary><Orders /></ErrorBoundary>} />
          <Route path="cloud-sync" element={<ErrorBoundary><CloudSync /></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
