import api from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  AccountingGroup,
  Voucher,
  Ledger,
  PaymentReceipt,
  TrialBalanceResponse,
  ProfitAndLossResponse,
  PartyLedgerResponse,
  LedgerTransactionsResponse,
} from '@/types';

export const accountingGroupsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<AccountingGroup>>('/accounting-groups', { params }),

  get: (id: string) =>
    api.get<ApiResponse<AccountingGroup>>(`/accounting-groups/${id}`),

  create: (data: Partial<AccountingGroup>) =>
    api.post<ApiResponse<AccountingGroup>>('/accounting-groups', data),

  update: (id: string, data: Partial<AccountingGroup>) =>
    api.put<ApiResponse<AccountingGroup>>(`/accounting-groups/${id}`, data),

  delete: (id: string) => api.delete(`/accounting-groups/${id}`),
};

export const vouchersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Voucher>>('/vouchers', { params }),

  get: (id: string) =>
    api.get<ApiResponse<Voucher>>(`/vouchers/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Voucher>>('/vouchers', data),
};

export const ledgersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Ledger>>('/ledgers', { params }),

  get: (id: string) =>
    api.get<ApiResponse<Ledger>>(`/ledgers/${id}`),

  balance: (id: string) =>
    api.get<{ data: { balance: number; balance_type: 'dr' | 'cr' } }>(`/ledgers/${id}/balance`),

  create: (data: Partial<Ledger>) =>
    api.post<ApiResponse<Ledger>>('/ledgers', data),

  update: (id: string, data: Partial<Ledger>) =>
    api.put<ApiResponse<Ledger>>(`/ledgers/${id}`, data),

  delete: (id: string) => api.delete(`/ledgers/${id}`),
};

export const reportsApi = {
  trialBalance: (params?: Record<string, string>) =>
    api.get<TrialBalanceResponse>('/reports/trial-balance', { params }),

  profitAndLoss: (params?: Record<string, string>) =>
    api.get<ProfitAndLossResponse>('/reports/profit-and-loss', { params }),

  partyLedger: (params: Record<string, string>) =>
    api.get<PartyLedgerResponse>('/reports/party-ledger', { params }),

  ledgerTransactions: (params: Record<string, string>) =>
    api.get<LedgerTransactionsResponse>('/reports/ledger-transactions', { params }),
};

export const paymentReceiptsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PaymentReceipt>>('/payment-receipts', { params }),

  get: (id: string) =>
    api.get<ApiResponse<PaymentReceipt>>(`/payment-receipts/${id}`),

  journal: (id: string) =>
    api.get<ApiResponse<Voucher | null>>(`/payment-receipts/${id}/journal`),

  create: (data: Partial<PaymentReceipt>) =>
    api.post<ApiResponse<PaymentReceipt>>('/payment-receipts', data),

  delete: (id: string) => api.delete(`/payment-receipts/${id}`),
};
