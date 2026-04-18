import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, ThermalTemplate } from '@/types';

export const thermalTemplatesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<ThermalTemplate>>('/thermal-templates', { params }),

  get: (id: string) =>
    api.get<ApiResponse<ThermalTemplate>>(`/thermal-templates/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<ThermalTemplate>>('/thermal-templates', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<ThermalTemplate>>(`/thermal-templates/${id}`, data),

  delete: (id: string) =>
    api.delete(`/thermal-templates/${id}`),

  setDefault: (id: string) =>
    api.patch<ApiResponse<ThermalTemplate>>(`/thermal-templates/${id}/set-default`, {}),

  loadDefaults: () =>
    api.post<ApiResponse<{ created: string[] }>>('/thermal-templates/load-defaults', {}),
};
