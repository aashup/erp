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

export interface Item extends SyncColumns {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  hsn_code: string | null;
  unit: string;
  category: string | null;
  gst_rate: number;
  mrp: number | null;
  purchase_price: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  is_batch_tracked: boolean;
  is_active: boolean;
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
  balance_type: 'debit' | 'credit' | null;
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
export interface ChartOfAccount extends SyncColumns {
  id: string;
  company_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  group: string | null;
  is_system: boolean;
  is_active: boolean;
  children?: ChartOfAccount[];
  parent?: ChartOfAccount;
}

export interface JournalEntry extends SyncColumns {
  id: string;
  company_id: string;
  financial_year_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: 'purchase' | 'sales' | 'payment' | 'receipt' | 'journal' | 'contra';
  narration: string | null;
  source: string | null;
  is_posted: boolean;
  lines?: JournalLine[];
}

export interface JournalLine extends SyncColumns {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  narration: string | null;
  account?: ChartOfAccount;
}

export interface PaymentReceipt extends SyncColumns {
  id: string;
  company_id: string;
  party_id: string;
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

export type CompanySettings = Record<string, string | null>;

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
