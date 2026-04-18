import api from '@/lib/axios';
import type { ApiResponse, Item, Party, SalesInvoice } from '@/types';

export interface POSItem extends Item {
  current_stock: number;
}

export interface POSCheckoutPayment {
  mode: 'cash' | 'upi' | 'card';
  amount: number;
  reference?: string;
}

export interface POSCheckoutLine {
  item_id: string;
  batch_id?: string | null;
  quantity: number;
  unit?: string | null;
  conversion_factor?: number;
  rate: number;
  discount_percent?: number;
  gst_rate: number;
}

export interface POSCheckoutPayload {
  party_id?: string | null;
  godown_id: string;
  is_inter_state?: boolean;
  invoice_date: string;
  notes?: string;
  lines: POSCheckoutLine[];
  payments: POSCheckoutPayment[];
  amount_tendered?: number;
  change_amount?: number;
}

export const posApi = {
  searchItems: (params: { search?: string; godown_id?: string; item_group_id?: string }) =>
    api.get<ApiResponse<POSItem[]>>('/pos/items', { params }),

  checkout: (data: POSCheckoutPayload) =>
    api.post<ApiResponse<SalesInvoice>>('/pos/checkout', data),

  hold: (data: Omit<POSCheckoutPayload, 'payments' | 'amount_tendered' | 'change_amount'>) =>
    api.post<ApiResponse<SalesInvoice>>('/pos/hold', data),

  getHeld: () =>
    api.get<ApiResponse<SalesInvoice[]>>('/pos/held'),

  deleteHeld: (id: string) =>
    api.delete(`/pos/held/${id}`),

  quickParty: (data: { name: string; phone?: string; email?: string }) =>
    api.post<ApiResponse<Party>>('/pos/quick-party', data),
};
