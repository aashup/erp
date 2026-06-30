import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, User } from '@/types';

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<User>>('/users', { params }),

  get: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),

  create: (data: Partial<User>) =>
    api.post<ApiResponse<User>>('/users', data),

  update: (id: string, data: Partial<User>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),

  impersonate: (userId: string) =>
    api.post<{ message: string; data: { token: string; user: User; permissions: string[] } }>(
      `/admin/impersonate/${userId}`
    ),

  revokeImpersonation: (userId: string) =>
    api.delete(`/admin/impersonate/${userId}`),
};
