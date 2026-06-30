import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // When sending FormData (file upload), remove the hardcoded Content-Type so
  // axios can set it automatically with the correct multipart/form-data boundary.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  // Auto-attach financial_year_id to all GET requests, but don't override an
  // explicitly passed financial_year_id (e.g. document counters for a specific FY)
  if (config.method === 'get' || !config.method) {
    if (!config.params?.financial_year_id) {
      const storedFY = localStorage.getItem('selectedFY');
      if (storedFY) {
        try {
          const fy = JSON.parse(storedFY);
          if (fy?.id) {
            config.params = { ...config.params, financial_year_id: fy.id };
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return config;
});

interface ApiValidationError {
  message: string;
  errors?: Record<string, string[]>;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiValidationError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('selectedFY');
      localStorage.removeItem('selectedDate');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const data = error.response?.data;

    if (data?.errors) {
      // 422 validation — collect all field errors into one toast
      const messages = Object.values(data.errors).flat();
      toast.error(messages.join('\n'), { duration: 5000 });
    } else if (data?.message) {
      // Other server errors with a message (403, 404, 409, 500, etc.)
      toast.error(data.message, { duration: 4000 });
    } else if (error.message === 'Network Error') {
      // Offline / unreachable
      toast.error('Network error — you may be offline.', { duration: 4000 });
    } else {
      toast.error('Something went wrong. Please try again.', { duration: 4000 });
    }

    return Promise.reject(error);
  }
);

export default api;
