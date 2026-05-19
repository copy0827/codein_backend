import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error?.response?.status;
    const url: string = original?.url || '';

    if (status === 401 && !original._retry && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = api.post('/auth/refresh').then((res) => {
          const token = res.data?.access_token;
          if (token) localStorage.setItem('access_token', token);
          return token;
        }).finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }

      try {
        const token = await refreshPromise;
        if (token) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
        }
        return api(original);
      } catch (e) {
        localStorage.removeItem('access_token');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
