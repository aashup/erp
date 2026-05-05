import { db } from './db';
import api from './axios';
import type { SalesInvoice } from '@/types';

type SyncTable =
  | 'items'
  | 'parties'
  | 'godowns'
  | 'branches'
  | 'batches'
  | 'purchaseOrders'
  | 'purchaseInvoices'
  | 'salesOrders'
  | 'salesInvoices'
  | 'vouchers'
  | 'paymentReceipts'
  | 'accountingGroups'
  | 'ledgers'
  | 'itemGroups'
  | 'units'
  | 'financialYears'
  | 'purchaseInvoiceLines'
  | 'salesInvoiceLines'
  | 'poLines'
  | 'soLines'
  | 'voucherLines';

const tableToApiName: Record<SyncTable, string> = {
  items:                'items',
  parties:              'parties',
  godowns:              'godowns',
  branches:             'branches',
  batches:              'batches',
  purchaseOrders:       'purchase_orders',
  purchaseInvoices:     'purchase_invoices',
  salesOrders:          'sales_orders',
  salesInvoices:        'sales_invoices',
  vouchers:             'vouchers',
  paymentReceipts:      'payment_receipts',
  accountingGroups:     'accounting_groups',
  ledgers:              'ledgers',
  itemGroups:           'item_groups',
  units:                'units',
  financialYears:       'financial_years',
  purchaseInvoiceLines: 'purchase_invoice_lines',
  salesInvoiceLines:    'sales_invoice_lines',
  poLines:              'po_lines',
  soLines:              'so_lines',
  voucherLines:         'voucher_lines',
};

function getLastSyncedAt(): string | null {
  return localStorage.getItem('last_synced_at');
}

function setLastSyncedAt(timestamp: string) {
  localStorage.setItem('last_synced_at', timestamp);
}

export async function pushPendingChanges(): Promise<number> {
  const changes: { table: string; records: unknown[] }[] = [];

  for (const [tableName, apiName] of Object.entries(tableToApiName)) {
    const table = db.table(tableName);
    const pending = await table.where('sync_status').equals('pending').toArray();

    if (pending.length > 0) {
      changes.push({ table: apiName, records: pending });
    }
  }

  if (changes.length === 0) return 0;

  const res = await api.post('/sync/push', { changes });
  const syncedCount = res.data.synced_count as number;
  const failedIds = new Set<string>(
    ((res.data.failed as { id: string }[]) ?? []).map((f) => f.id)
  );

  // Mark pushed records as synced (or conflict if the server rejected them)
  for (const change of changes) {
    const localTable = Object.entries(tableToApiName).find(
      ([, v]) => v === change.table
    )?.[0];
    if (!localTable) continue;

    const table = db.table(localTable);
    for (const record of change.records as { id: string }[]) {
      if (failedIds.has(record.id)) {
        await table.update(record.id, { sync_status: 'conflict' });
      } else {
        await table.update(record.id, {
          sync_status: 'synced',
          synced_at: new Date().toISOString(),
        });
      }
    }
  }

  return syncedCount;
}

export async function pullServerChanges(): Promise<number> {
  const lastSyncedAt = getLastSyncedAt();

  const res = await api.get('/sync/pull', {
    params: lastSyncedAt ? { last_synced_at: lastSyncedAt } : {},
  });

  const { data, synced_at } = res.data as {
    data: Record<string, unknown[]>;
    synced_at: string;
  };

  let totalPulled = 0;

  for (const [apiName, records] of Object.entries(data)) {
    const localTable = Object.entries(tableToApiName).find(
      ([, v]) => v === apiName
    )?.[0];
    if (!localTable) continue;

    const table = db.table(localTable);

    for (const record of records as { id: string }[]) {
      const existing = await table.get(record.id);

      if (existing && existing.sync_status === 'pending') {
        // Local has unsaved changes — flag as conflict
        await table.update(record.id, { sync_status: 'conflict' });
      } else {
        // Server wins — upsert
        await table.put({ ...record, sync_status: 'synced' });
      }
      totalPulled++;
    }
  }

  setLastSyncedAt(synced_at);
  return totalPulled;
}

export async function syncAll(): Promise<{ pushed: number; pulled: number }> {
  const pushed = await pushPendingChanges();
  const pulled = await pullServerChanges();
  return { pushed, pulled };
}

/**
 * Full bootstrap pull — clears last_synced_at so ALL company data is fetched.
 * Call once after login to seed Dexie with the complete dataset.
 */
export async function bootstrapAllData(): Promise<number> {
  localStorage.removeItem('last_synced_at');
  return pullServerChanges();
}

/**
 * Wipe all local Dexie tables and clear sync timestamp.
 * Call on logout so the next user starts with a clean slate.
 */
export async function clearLocalData(): Promise<void> {
  await Promise.all(
    Object.keys(tableToApiName).map((tableName) => db.table(tableName).clear())
  );
  localStorage.removeItem('last_synced_at');
}

/**
 * Build a Dexie record for offline-first creates/updates.
 * Sets sync_status:'pending' so the sync engine pushes it when back online.
 */
export function buildSyncRecord<T>(
  data: Partial<T>,
  companyId: string,
  existingId?: string,
  existingCreatedAt?: string,
): T {
  const now = new Date().toISOString();
  return {
    ...data,
    id: existingId ?? crypto.randomUUID(),
    company_id: companyId,
    sync_status: 'pending' as const,
    device_id: null,
    synced_at: null,
    updated_at_local: now,
    created_at: existingCreatedAt ?? now,
    updated_at: now,
  } as T;
}

export function getPendingCount(): Promise<number> {
  const counts = [
    ...Object.keys(tableToApiName).map((tableName) =>
      db.table(tableName).where('sync_status').equals('pending').count()
    ),
    db.posPendingCheckouts.count(),
  ];
  return Promise.all(counts).then((c) => c.reduce((a, b) => a + b, 0));
}

/**
 * Replay pending offline POS checkouts via /pos/checkout.
 * Must run BEFORE syncAll() so temp placeholder invoices are replaced
 * before the generic push phase tries to push them.
 */
export async function syncPendingPOSCheckouts(): Promise<number> {
  const pending = await db.posPendingCheckouts.orderBy('created_at').toArray();
  let synced = 0;
  for (const item of pending) {
    try {
      const res = await api.post<{ data: SalesInvoice }>('/pos/checkout', item.payload);
      const inv = res.data.data;
      // Replace temp placeholder with real server invoice
      await db.salesInvoices.put({ ...inv, sync_status: 'synced' });
      await db.salesInvoices.delete(item.id);
      await db.posPendingCheckouts.delete(item.id);
      synced++;
    } catch {
      // Keep in queue — will retry on next sync
    }
  }
  return synced;
}
