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
  BalanceSheetResponse,
  PartyLedgerResponse,
  LedgerTransactionsResponse,
  CashBookResponse,
  BankBookResponse,
  DayBookResponse,
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

export interface AuditTrailEntry {
  id: number;
  created_at: string;
  event: string | null;
  log_name: string | null;
  description: string;
  subject_type: string | null;
  subject_type_class: string | null;
  subject_id: string | null;
  subject_label: string | null;
  causer: { id: string; name: string; email: string } | null;
  properties: { attributes?: Record<string, unknown>; old?: Record<string, unknown> } | null;
  batch_uuid: string | null;
}

export interface AuditTrailResponse {
  data: AuditTrailEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface AuditTrailFiltersResponse {
  users: { id: string; name: string; email: string }[];
  subject_types: { key: string; label: string }[];
  events: string[];
}

export const reportsApi = {
  trialBalance: (params?: Record<string, string>) =>
    api.get<TrialBalanceResponse>('/reports/trial-balance', { params }),

  auditTrail: (params?: Record<string, string | number>) =>
    api.get<AuditTrailResponse>('/reports/audit-trail', { params }),

  auditTrailFilters: () =>
    api.get<AuditTrailFiltersResponse>('/reports/audit-trail/filters'),

  profitAndLoss: (params?: Record<string, string>) =>
    api.get<ProfitAndLossResponse>('/reports/profit-and-loss', { params }),

  balanceSheet: (params?: Record<string, string>) =>
    api.get<BalanceSheetResponse>('/reports/balance-sheet', { params }),

  partyLedger: (params: Record<string, string>) =>
    api.get<PartyLedgerResponse>('/reports/party-ledger', { params }),

  ledgerTransactions: (params: Record<string, string>) =>
    api.get<LedgerTransactionsResponse>('/reports/ledger-transactions', { params }),

  cashBook: (params?: Record<string, string>) =>
    api.get<CashBookResponse>('/reports/cash-book', { params }),

  bankBook: (params?: Record<string, string>) =>
    api.get<BankBookResponse>('/reports/bank-book', { params }),

  dayBook: (params?: Record<string, string>) =>
    api.get<DayBookResponse>('/reports/day-book', { params }),
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
