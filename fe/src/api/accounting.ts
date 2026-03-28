import api from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  ChartOfAccount,
  JournalEntry,
  PaymentReceipt,
  TrialBalanceResponse,
  ProfitAndLossResponse,
  PartyLedgerResponse,
} from '@/types';

export const chartOfAccountsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<ChartOfAccount>>('/chart-of-accounts', { params }),

  get: (id: string) =>
    api.get<ApiResponse<ChartOfAccount>>(`/chart-of-accounts/${id}`),

  update: (id: string, data: Partial<ChartOfAccount>) =>
    api.put<ApiResponse<ChartOfAccount>>(`/chart-of-accounts/${id}`, data),

  delete: (id: string) => api.delete(`/chart-of-accounts/${id}`),
};

export const journalEntriesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<JournalEntry>>('/journal-entries', { params }),

  get: (id: string) =>
    api.get<ApiResponse<JournalEntry>>(`/journal-entries/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<JournalEntry>>('/journal-entries', data),
};

export const reportsApi = {
  trialBalance: (params?: Record<string, string>) =>
    api.get<TrialBalanceResponse>('/reports/trial-balance', { params }),

  profitAndLoss: (params?: Record<string, string>) =>
    api.get<ProfitAndLossResponse>('/reports/profit-and-loss', { params }),

  partyLedger: (params: Record<string, string>) =>
    api.get<PartyLedgerResponse>('/reports/party-ledger', { params }),
};

export const paymentReceiptsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PaymentReceipt>>('/payment-receipts', { params }),

  get: (id: string) =>
    api.get<ApiResponse<PaymentReceipt>>(`/payment-receipts/${id}`),

  create: (data: Partial<PaymentReceipt>) =>
    api.post<ApiResponse<PaymentReceipt>>('/payment-receipts', data),

  delete: (id: string) => api.delete(`/payment-receipts/${id}`),
};
