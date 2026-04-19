import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, PurchaseOrder, PurchaseInvoice } from '@/types';

export const purchaseOrdersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params }),

  get: (id: string) =>
    api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, data),

  delete: (id: string) => api.delete(`/purchase-orders/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/status`, { status }),

  receiveItems: (id: string, data: {
    receipt_date?: string;
    notes?: string;
    lines: { po_line_id: string; quantity: number }[];
  }) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/receive`, data),
};

export const purchaseInvoicesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PurchaseInvoice>>('/purchase-invoices', { params }),

  get: (id: string) =>
    api.get<ApiResponse<PurchaseInvoice>>(`/purchase-invoices/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<PurchaseInvoice>>('/purchase-invoices', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<PurchaseInvoice>>(`/purchase-invoices/${id}`, data),

  delete: (id: string) => api.delete(`/purchase-invoices/${id}`),

  bulkCancel: (ids: string[]) =>
    api.post<ApiResponse<{ cancelled: number; skipped: number; message: string }>>('/purchase-invoices/bulk-cancel', { ids }),
};
