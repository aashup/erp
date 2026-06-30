import api from "@/lib/axios";

export interface TallyConnectionResult {
  connected: boolean;
  url: string;
  message: string;
  company?: string;
}

export interface TallyGroupPreview {
  name: string;
  parent: string | null;
  children: TallyGroupPreview[];
}

export interface TallyGroupFetchResponse {
  data: TallyGroupPreview[];
  count: number;
}

export interface TallyLedgerPreview {
  name: string;
  parent: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  opening_balance: number;
  balance_type: "dr" | "cr";
  party_type: "customer" | "vendor" | null;
}

export interface TallyStockItemPreview {
  name: string;
  parent: string;
  unit: string;
  hsn_code: string | null;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface ImportError {
  entity: string;
  name: string;
  reason: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  created_names: string[];
}

export interface TallyLedgerFetchResponse {
  data: TallyLedgerPreview[];
  count: number;
}

export interface TallyStockItemFetchResponse {
  data: TallyStockItemPreview[];
  count: number;
}

export type TallyConnectionMethod = "xml" | "odbc";

export const tallyImportApi = {
  testConnection: () =>
    api.get<TallyConnectionResult>("/tally/test-connection"),

  testOdbcConnection: () =>
    api.get<TallyConnectionResult>("/tally/test-odbc-connection"),

  fetchGroups: () =>
    api.get<TallyGroupFetchResponse>("/tally/fetch-groups"),

  fetchLedgers: (connectionMethod: TallyConnectionMethod = "xml") =>
    api.get<TallyLedgerFetchResponse>("/tally/fetch-ledgers", {
      params: { connection_method: connectionMethod },
    }),

  importLedgers: (payload: {
    mode: "live" | "file";
    xml_content?: string;
    connection_method?: TallyConnectionMethod;
  }) => api.post<ImportResult>("/tally/import-ledgers", payload),

  fetchStockItems: (connectionMethod: TallyConnectionMethod = "xml") =>
    api.get<TallyStockItemFetchResponse>("/tally/fetch-stock-items", {
      params: { connection_method: connectionMethod },
    }),

  importStockItems: (payload: {
    mode: "live" | "file";
    xml_content?: string;
    connection_method?: TallyConnectionMethod;
  }) => api.post<ImportResult>("/tally/import-stock-items", payload),

  importVouchers: (payload: {
    mode: "live" | "file";
    date_from?: string;
    date_to?: string;
    xml_content?: string;
    connection_method?: TallyConnectionMethod;
  }) => api.post<ImportResult>("/tally/import-vouchers", payload),
};
