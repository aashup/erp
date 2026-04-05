import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, SalesOrder, SalesInvoice } from '@/types';

export const salesOrdersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<SalesOrder>>('/sales-orders', { params }),

  get: (id: string) =>
    api.get<ApiResponse<SalesOrder>>(`/sales-orders/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<SalesOrder>>('/sales-orders', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<SalesOrder>>(`/sales-orders/${id}`, data),

  delete: (id: string) => api.delete(`/sales-orders/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<SalesOrder>>(`/sales-orders/${id}/status`, { status }),
};

export const salesInvoicesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<SalesInvoice>>('/sales-invoices', { params }),

  get: (id: string) =>
    api.get<ApiResponse<SalesInvoice>>(`/sales-invoices/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<SalesInvoice>>('/sales-invoices', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<SalesInvoice>>(`/sales-invoices/${id}`, data),

  delete: (id: string) => api.delete(`/sales-invoices/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<SalesInvoice>>(`/sales-invoices/${id}/status`, { status }),

  downloadPdf: (id: string, template?: string) =>
    api.get(`/sales-invoices/${id}/pdf`, {
      params: template ? { template } : {},
      responseType: 'blob',
    }),

  getHtml: (id: string, template?: string) =>
    api.get<string>(`/sales-invoices/${id}/html`, {
      params: template ? { template } : {},
      responseType: 'text',
    }),

  getThermalHtml: (id: string, paperSize: '2inch' | '3inch') =>
    api.get<string>(`/sales-invoices/${id}/html`, {
      params: { template: 'thermal', paper_size: paperSize },
      responseType: 'text',
    }),
};
