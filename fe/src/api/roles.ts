import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, Role, Permission } from '@/types';

interface RolePayload {
  name?: string;
  permissions?: string[]; // flat array of permission UUIDs
}

export const rolesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Role>>('/roles', { params }),

  get: (uuid: string) => api.get<ApiResponse<Role>>(`/roles/${uuid}`),

  create: (data: RolePayload) =>
    api.post<ApiResponse<Role>>('/roles', data),

  update: (uuid: string, data: RolePayload) =>
    api.put<ApiResponse<Role>>(`/roles/${uuid}`, data),

  delete: (uuid: string) => api.delete(`/roles/${uuid}`),

  permissions: () => api.get<ApiResponse<Record<string, Permission[]>>>('/permissions'),
};
