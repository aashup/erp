import api from '@/lib/axios';
import type { ApiResponse, Party, PaginatedResponse } from '@/types';

export const partiesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Party>>('/parties', { params }),

  get: (id: string) => api.get<ApiResponse<Party>>(`/parties/${id}`),

  create: (data: Partial<Party>) =>
    api.post<ApiResponse<Party>>('/parties', data),

  update: (id: string, data: Partial<Party>) =>
    api.put<ApiResponse<Party>>(`/parties/${id}`, data),

  delete: (id: string) => api.delete(`/parties/${id}`),
};
