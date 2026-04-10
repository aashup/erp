// Sync columns present on every model
export interface SyncColumns {
  sync_status: 'pending' | 'synced' | 'conflict';
  device_id: string | null;
  synced_at: string | null;
  updated_at_local: string;
  created_at: string;
  updated_at: string;
}

export interface Company extends SyncColumns {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
}

export interface User extends SyncColumns {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'manager' | 'accountant' | 'salesman';
  is_active: boolean;
  company?: Company;
  branch?: Branch;
}

export interface Branch extends SyncColumns {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  is_active: boolean;
}

export interface FinancialYear extends SyncColumns {
  id: string;
  company_id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  is_current: boolean;
}

export interface ItemGroup extends SyncColumns {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  is_active: boolean;
  children?: ItemGroup[];
  parent?: ItemGroup;
}

export interface Item extends SyncColumns {
  id: string;
  company_id: string;
  item_group_id: string | null;
  name: string;
  sku: string | null;
  hsn_code: string | null;
  unit: string;
  igst: number;
  sgst: number;
  cgst: number;
  mrp: number | null;
  purchase_price: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  is_batch_tracked: boolean;
  is_active: boolean;
  item_group?: ItemGroup;
  batches?: Batch[];
}

export interface Batch extends SyncColumns {
  id: string;
  item_id: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  purchase_price: number | null;
  selling_price: number | null;
}

export interface Godown extends SyncColumns {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  code: string | null;
  address: string | null;
  is_default: boolean;
  is_active: boolean;
  branch?: Branch;
}

export interface Unit extends SyncColumns {
  id: string;
  company_id: string;
  value: string;
  label: string;
  status: 'active' | 'inactive';
}

export interface Party extends SyncColumns {
  id: string;
  company_id: string;
  type: 'customer' | 'vendor' | 'both';
  name: string;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  credit_limit: number | null;
  opening_balance: number | null;
  balance_type: 'dr' | 'cr' | null;
  debtor_ledger_id: string | null;
  creditor_ledger_id: string | null;
  is_active: boolean;
}

// Purchase
export interface PurchaseOrder extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
  branch_id: string | null;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  total_amount: number;
  gst_amount: number;
  grand_total: number;
  notes: string | null;
  created_by: string | null;
  party?: Party;
  branch?: Branch;
  lines?: PoLine[];
}

export interface PoLine extends SyncColumns {
  id: string;
  purchase_order_id: string;
  item_id: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
  received_quantity: number;
  item?: Item;
}

export interface PurchaseInvoice extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
  branch_id: string | null;
  purchase_order_id: string | null;
  godown_id: string | null;
  invoice_number: string;
  vendor_invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  is_inter_state: boolean;
  status: 'draft' | 'confirmed' | 'cancelled';
  total_amount: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  party?: Party;
  lines?: PurchaseInvoiceLine[];
}

export interface PurchaseInvoiceLine extends SyncColumns {
  id: string;
  purchase_invoice_id: string;
  item_id: string;
  batch_id: string | null;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
  item?: Item;
}

// Sales
export interface SalesOrder extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
  branch_id: string | null;
  so_number: string;
  so_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'confirmed' | 'partially_delivered' | 'delivered' | 'cancelled';
  total_amount: number;
  gst_amount: number;
  grand_total: number;
  notes: string | null;
  created_by: string | null;
  party?: Party;
  branch?: Branch;
  lines?: SoLine[];
}

export interface SoLine extends SyncColumns {
  id: string;
  sales_order_id: string;
  item_id: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
  delivered_quantity: number;
  item?: Item;
}

export interface SalesInvoice extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
  branch_id: string | null;
  sales_order_id: string | null;
  godown_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  is_inter_state: boolean;
  is_printed: boolean;
  status: 'draft' | 'confirmed' | 'cancelled';
  total_amount: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  party?: Party;
  lines?: SalesInvoiceLine[];
}

export interface SalesInvoiceLine extends SyncColumns {
  id: string;
  sales_invoice_id: string;
  item_id: string;
  batch_id: string | null;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
  item?: Item;
}

// Accounting
export interface AccountingGroup extends SyncColumns {
  id: string;
  company_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  is_system: boolean;
  is_active: boolean;
  balance_type: 'dr' | 'cr';
  children?: AccountingGroup[];
  parent?: AccountingGroup;
  ledgers?: Ledger[];
}

export interface Voucher extends SyncColumns {
  id: string;
  company_id: string;
  financial_year_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: 'purchase' | 'sales' | 'payment' | 'receipt' | 'journal' | 'contra';
  narration: string | null;
  source: string | null;
  is_posted: boolean;
  lines?: VoucherLine[];
}

export interface VoucherLine extends SyncColumns {
  id: string;
  voucher_id: string;
  ledger_id: string;
  debit: number;
  credit: number;
  narration: string | null;
  ledger?: Ledger;
}

export interface Ledger extends SyncColumns {
  id: string;
  company_id: string;
  name: string;
  alias: string | null;
  group_id: string;
  opening_balance: number;
  opening_type: 'dr' | 'cr';
  opening_date: string | null;
  is_bill_wise: boolean;
  is_cost_center_applicable: boolean;
  allow_manual_entry: boolean;
  is_system: boolean;
  ledgerable_type: string | null;
  ledgerable_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  group?: AccountingGroup;
}

export interface PaymentReceipt extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
  purchase_invoice_id: string | null;
  sales_invoice_id: string | null;
  type: 'payment' | 'receipt';
  receipt_number: string;
  receipt_date: string;
  amount: number;
  payment_mode: 'cash' | 'bank' | 'cheque' | 'upi' | 'other';
  reference_number: string | null;
  bank_name: string | null;
  notes: string | null;
  party?: Party;
}

// Invoice Templates & Company Settings
export interface InvoiceTemplate {
  slug: string;
  name: string;
  description: string;
}

export interface UnitOption {
  value: string;
  label: string;
}

export interface CompanySettings {
  [key: string]: string | UnitOption[] | null | undefined;
  default_invoice_template?: string | null;
  item_units?: UnitOption[];
  thermal_printer_paper_size?: '2inch' | '3inch' | null;
}

export interface ThermalTemplate extends SyncColumns {
  id: string;
  company_id: string;
  name: string;
  html_content: string;
  paper_size: '2inch' | '3inch';
  is_default: boolean;
  created_by: string;
  updated_by?: string | null;
}

// Stock / Inventory
export interface StockLedgerEntry {
  id: string;
  company_id: string;
  item_id: string;
  batch_id: string | null;
  godown_id: string;
  type: 'purchase' | 'purchase_return' | 'sale' | 'sale_return' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'opening';
  reference_type: string | null;
  reference_id: string | null;
  quantity: number;
  rate: number;
  value: number;
  narration: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
  batch?: Batch;
  godown?: Godown;
}

export interface StockSummaryRow {
  item_id: string;
  godown_id: string;
  current_stock: number;
  item?: Item;
  godown?: Godown;
}

export interface ReorderAlert {
  item_id: string;
  item_name: string;
  sku: string | null;
  unit: string;
  reorder_level: number;
  current_stock: number;
  deficit: number;
}

// Reports
export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  parent_id: string | null;
  is_group: boolean;
  opening_debit: number;
  opening_credit: number;
  txn_debit: number;
  txn_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface TrialBalanceResponse {
  data: TrialBalanceRow[];
  summary: {
    total_debit: number;
    total_credit: number;
    difference: number;
  };
}

export interface PnlRow {
  account_id: string;
  name: string;
  code: string;
  type: 'income' | 'expense';
  parent_id: string | null;
  is_group: boolean;
  amount: number; // for groups: 0 (aggregated in frontend); for ledgers: net income/expense
}

export interface ProfitAndLossResponse {
  data: PnlRow[];
  summary: {
    total_income: number;
    total_expense: number;
    opening_stock: number;   // stock value at period start (from stock_ledger)
    closing_stock: number;   // stock value at period end (from stock_ledger)
    net_profit_loss: number; // (income + closing_stock) - (expense + opening_stock)
    is_profit: boolean;
  };
}

export interface PartyLedgerRow {
  voucher_number: string;
  voucher_date: string;
  voucher_type: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface PartyLedgerResponse {
  data: PartyLedgerRow[];
  party: {
    id: string;
    name: string;
    type: string;
  };
  opening_balance: number;
  closing_balance: number;
}

export interface LedgerTransactionRow {
  voucher_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: string;
  narration: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerTransactionsResponse {
  ledger: {
    id: string;
    name: string;
    group_name: string | null;
    opening_debit: number;
    opening_credit: number;
  };
  data: LedgerTransactionRow[];
  closing_balance: number;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface LoginResponse {
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface RegisterResponse {
  message: string;
  data: {
    company: Company;
    user: User;
    token: string;
  };
}
