import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Lock, User, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/vendedores/login', {
        email,
        password,
      });

      const { token, user } = response.data;
      
      // Guardar localmente
      localStorage.setItem('payload-token', token);
      localStorage.setItem('payload-user', JSON.stringify(user));

      navigate('/'); // Redirigir al inicio
    } catch (err: any) {
      console.error('Error detallado de Axios:', err);
      if (err.message === 'Network Error') {
        setError('Error de Red (CORS o sin internet). Revisa la consola para más detalles.');
      } else if (err.response && err.response.status === 401) {
        setError('Credenciales inválidas.');
      } else {
        setError(`Error del servidor: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-600 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-600">ForceLoan</h1>
          <p className="text-gray-500 mt-2 text-sm">Portal de Vendedores Offline</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                placeholder="vendedor@empresa.com" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold p-3 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Ingresar
          </button>
        </form>
      </div>
      
      <p className="text-blue-200 text-xs mt-8">
        La aplicación funcionará offline una vez inicies sesión.
      </p>
    </div>
  );
};
