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
} from '@/types';

class ErpDatabase extends Dexie {
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

  constructor() {
    super('erpdb');

    this.version(1).stores({
      items: 'id, company_id, name, sku, category, sync_status',
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
  }
}

export const db = new ErpDatabase();
