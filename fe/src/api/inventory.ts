import api from '@/lib/axios';
import type { ApiResponse, Batch, Item, ItemGroup, Godown, PaginatedResponse, StockLedgerEntry, StockSummaryRow, ReorderAlert } from '@/types';

export const itemGroupsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<ItemGroup>>('/item-groups', { params }),

  get: (id: string) => api.get<ApiResponse<ItemGroup>>(`/item-groups/${id}`),

  create: (data: Partial<ItemGroup>) =>
    api.post<ApiResponse<ItemGroup>>('/item-groups', data),

  update: (id: string, data: Partial<ItemGroup>) =>
    api.put<ApiResponse<ItemGroup>>(`/item-groups/${id}`, data),

  delete: (id: string) => api.delete(`/item-groups/${id}`),
};

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

export const stockLedgerApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<StockLedgerEntry>>('/stock-ledger', { params }),

  summary: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<StockSummaryRow>>('/stock-summary', { params }),

  createOpening: (data: { item_id: string; godown_id: string; batch_id?: string; quantity: number; rate: number; narration?: string }) =>
    api.post<ApiResponse<StockLedgerEntry>>('/stock-ledger/opening', data),

  createAdjustment: (data: { item_id: string; godown_id: string; batch_id?: string; quantity: number; rate: number; narration: string }) =>
    api.post<ApiResponse<StockLedgerEntry>>('/stock-ledger/adjustment', data),

  createTransfer: (data: { item_id: string; from_godown_id: string; to_godown_id: string; batch_id?: string; quantity: number; rate: number; narration?: string }) =>
    api.post<ApiResponse<StockLedgerEntry[]>>('/stock-ledger/transfer', data),

  reorderAlerts: () =>
    api.get<ApiResponse<ReorderAlert[]>>('/stock-ledger/reorder-alerts'),

  itemMovements: (itemId: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<StockLedgerEntry>>(`/items/${itemId}/movements`, { params }),
};

export const batchesApi = {
  list: (itemId: string) =>
    api.get<ApiResponse<Batch[]>>(`/items/${itemId}/batches`),

  create: (itemId: string, data: Partial<Batch>) =>
    api.post<ApiResponse<Batch>>(`/items/${itemId}/batches`, data),

  update: (batchId: string, data: Partial<Batch>) =>
    api.put<ApiResponse<Batch>>(`/batches/${batchId}`, data),

  delete: (batchId: string) =>
    api.delete(`/batches/${batchId}`),

  expiring: (params?: Record<string, string>) =>
    api.get<ApiResponse<Batch[]>>('/batches/expiring', { params }),
};
