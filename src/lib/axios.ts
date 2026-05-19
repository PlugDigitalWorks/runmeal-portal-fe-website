import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_URL = 
  typeof window === 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') 
    : '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-mode': 'body', // Request tokens in body
  },
});

api.interceptors.request.use(async (config) => {
  let token: string | undefined;

  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    token = cookieStore.get('accessToken')?.value;
  } else {
    token = Cookies.get('accessToken');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryQueueItem {
  resolve: (value?: unknown) => void;
  reject: (error?: unknown) => void;
  config: InternalAxiosRequestConfig;
}

// Queue to hold requests while refreshing token
let isRefreshing = false;
let failedQueue: RetryQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      if (prom.config.headers) {
        prom.config.headers.Authorization = `Bearer ${token}`;
      }
      prom.resolve(api(prom.config));
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {

      if (originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
      let refreshToken: string | undefined;
      let sid: string | undefined;

      if (typeof window === 'undefined') {
          const { cookies } = await import('next/headers');
          const cookieStore = await cookies();
          refreshToken = cookieStore.get('refreshToken')?.value;
          sid = cookieStore.get('sid')?.value;
      } else {
          refreshToken = Cookies.get('refreshToken');
          sid = Cookies.get('sid');
      }

        if (!refreshToken || !sid) {
           throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
            sid
        }, {
             headers: {
                'x-auth-mode': 'body'
            }
        });

        const data = response.data.data || response.data;
        const { accessToken, refreshToken: newRefresh, sid: newSid } = data;

        Cookies.set('accessToken', accessToken);
        if (newRefresh) Cookies.set('refreshToken', newRefresh);
        if (newSid) Cookies.set('sid', newSid);

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`; // update existing request

        processQueue(null, accessToken);
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear tokens and redirect to login
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        Cookies.remove('sid');
        Cookies.remove('user');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
