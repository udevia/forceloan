import axios from 'axios';

const API_URL = 'https://galpon.loanmayorista.site/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos máximo para considerar error de red
});

// Interceptor para inyectar el token en cada petición (si existe)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('payload-token');
    if (token && config.headers) {
      config.headers.Authorization = `JWT ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para limpiar token si el backend responde 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('payload-token');
      localStorage.removeItem('payload-user');
      // Podríamos redirigir a /login aquí
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
