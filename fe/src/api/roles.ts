import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, Role, Permission } from '@/types';

export const rolesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Role>>('/roles', { params }),

  get: (id: string) => api.get<ApiResponse<Role>>(`/roles/${id}`),

  create: (data: Partial<Role>) =>
    api.post<ApiResponse<Role>>('/roles', data),

  update: (id: string, data: Partial<Role>) =>
    api.put<ApiResponse<Role>>(`/roles/${id}`, data),

  delete: (id: string) => api.delete(`/roles/${id}`),

  permissions: () => api.get<ApiResponse<Record<string, Permission[]>>>('/permissions'),
};
