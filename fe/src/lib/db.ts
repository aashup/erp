import Dexie, { type EntityTable } from 'dexie';
import type {
  Item,
  Party,
  Godown,
  Branch,
  Batch,
  PurchaseOrder,
  PurchaseInvoice,
  SalesOrder,
  SalesInvoice,
  Voucher,
  PaymentReceipt,
  AccountingGroup,
  Ledger,
  ItemGroup,
  Unit,
  FinancialYear,
  PoLine,
  SoLine,
  PurchaseInvoiceLine,
  SalesInvoiceLine,
  VoucherLine,
  POSPendingCheckout,
} from '@/types';

class ErpDatabase extends Dexie {
  // v1 tables
  items!: EntityTable<Item, 'id'>;
  parties!: EntityTable<Party, 'id'>;
  godowns!: EntityTable<Godown, 'id'>;
  branches!: EntityTable<Branch, 'id'>;
  batches!: EntityTable<Batch, 'id'>;
  purchaseOrders!: EntityTable<PurchaseOrder, 'id'>;
  purchaseInvoices!: EntityTable<PurchaseInvoice, 'id'>;
  salesOrders!: EntityTable<SalesOrder, 'id'>;
  salesInvoices!: EntityTable<SalesInvoice, 'id'>;
  vouchers!: EntityTable<Voucher, 'id'>;
  paymentReceipts!: EntityTable<PaymentReceipt, 'id'>;
  accountingGroups!: EntityTable<AccountingGroup, 'id'>;

  // v2 tables
  ledgers!: EntityTable<Ledger, 'id'>;

  // v3 tables
  itemGroups!: EntityTable<ItemGroup, 'id'>;
  units!: EntityTable<Unit, 'id'>;
  financialYears!: EntityTable<FinancialYear, 'id'>;
  purchaseInvoiceLines!: EntityTable<PurchaseInvoiceLine, 'id'>;
  salesInvoiceLines!: EntityTable<SalesInvoiceLine, 'id'>;
  poLines!: EntityTable<PoLine, 'id'>;
  soLines!: EntityTable<SoLine, 'id'>;
  voucherLines!: EntityTable<VoucherLine, 'id'>;

  // v5 tables
  posPendingCheckouts!: EntityTable<POSPendingCheckout, 'id'>;

  constructor() {
    super('erpdb');

    this.version(1).stores({
      items: 'id, company_id, name, sku, item_group_id, sync_status',
      parties: 'id, company_id, type, name, sync_status',
      godowns: 'id, company_id, branch_id, sync_status',
      branches: 'id, company_id, sync_status',
      batches: 'id, item_id, sync_status',
      purchaseOrders: 'id, company_id, party_id, po_number, status, sync_status',
      purchaseInvoices: 'id, company_id, party_id, invoice_number, status, sync_status',
      salesOrders: 'id, company_id, party_id, so_number, status, sync_status',
      salesInvoices: 'id, company_id, party_id, invoice_number, status, sync_status',
      vouchers: 'id, company_id, voucher_number, voucher_type, sync_status',
      paymentReceipts: 'id, company_id, party_id, receipt_number, sync_status',
      accountingGroups: 'id, company_id, type, code, sync_status',
    });

    this.version(2).stores({
      ledgers: 'id, company_id, group_id, name, system_key, sync_status',
    });

    this.version(3).stores({
      itemGroups:           'id, company_id, parent_id, sync_status',
      units:                'id, company_id, sync_status',
      financialYears:       'id, company_id, is_current, sync_status',
      purchaseInvoiceLines: 'id, purchase_invoice_id, item_id, sync_status',
      salesInvoiceLines:    'id, sales_invoice_id, item_id, sync_status',
      poLines:              'id, purchase_order_id, item_id, sync_status',
      soLines:              'id, sales_order_id, item_id, sync_status',
      voucherLines:         'id, voucher_id, ledger_id, sync_status',
    });

    // v4: batches are now synced via /sync/pull (backend fix).
    // Clearing last_synced_at forces a full pull so existing batch records
    // are downloaded on the next sync rather than missed by delta comparison.
    this.version(4).upgrade(() => {
      localStorage.removeItem('last_synced_at');
    });

    // v5: dedicated queue for pending POS checkouts (offline sales awaiting replay
    // via /pos/checkout — cannot use generic sync/push due to server-side side effects).
    this.version(5).stores({
      posPendingCheckouts: 'id, company_id, created_at',
    });
  }
}

export const db = new ErpDatabase();
