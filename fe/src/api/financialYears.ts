import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, FinancialYear } from '@/types';

export const financialYearsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<FinancialYear>>('/financial-years', { params }),

  get: (id: string) =>
    api.get<ApiResponse<FinancialYear>>(`/financial-years/${id}`),

  create: (data: Partial<FinancialYear>) =>
    api.post<ApiResponse<FinancialYear>>('/financial-years', data),

  update: (id: string, data: Partial<FinancialYear>) =>
    api.put<ApiResponse<FinancialYear>>(`/financial-years/${id}`, data),

  delete: (id: string) => api.delete(`/financial-years/${id}`),

  setCurrent: (id: string) =>
    api.patch<ApiResponse<FinancialYear>>(`/financial-years/${id}/set-current`),
};
