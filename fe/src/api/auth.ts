import api from '@/lib/axios';
import type { LoginResponse, RegisterResponse } from '@/types';

export const authApi = {
  register: (data: {
    company_name: string;
    gstin?: string;
    state: string;
    state_code: string;
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
  }) => api.post<RegisterResponse>('/register', data),

  login: (data: { email: string; password: string; device_name: string }) =>
    api.post<LoginResponse>('/login', data),

  me: () => api.get('/me'),

  logout: () => api.post('/logout'),
};
