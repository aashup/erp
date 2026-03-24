import api from '@/lib/axios';
import type { ApiResponse, Item, Godown, PaginatedResponse } from '@/types';

export const itemsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Item>>('/items', { params }),

  get: (id: string) => api.get<ApiResponse<Item>>(`/items/${id}`),

  create: (data: Partial<Item>) => api.post<ApiResponse<Item>>('/items', data),

  update: (id: string, data: Partial<Item>) =>
    api.put<ApiResponse<Item>>(`/items/${id}`, data),

  delete: (id: string) => api.delete(`/items/${id}`),
};

export const godownsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Godown>>('/godowns', { params }),

  get: (id: string) => api.get<ApiResponse<Godown>>(`/godowns/${id}`),

  create: (data: Partial<Godown>) =>
    api.post<ApiResponse<Godown>>('/godowns', data),

  update: (id: string, data: Partial<Godown>) =>
    api.put<ApiResponse<Godown>>(`/godowns/${id}`, data),

  delete: (id: string) => api.delete(`/godowns/${id}`),
};
