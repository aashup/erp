import { db } from './db';
import api from './axios';

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
  | 'accountingGroups';

const tableToApiName: Record<SyncTable, string> = {
  items: 'items',
  parties: 'parties',
  godowns: 'godowns',
  branches: 'branches',
  batches: 'batches',
  purchaseOrders: 'purchase_orders',
  purchaseInvoices: 'purchase_invoices',
  salesOrders: 'sales_orders',
  salesInvoices: 'sales_invoices',
  vouchers: 'vouchers',
  paymentReceipts: 'payment_receipts',
  accountingGroups: 'accounting_groups',
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

  // Mark pushed records as synced in local DB
  for (const change of changes) {
    const localTable = Object.entries(tableToApiName).find(
      ([, v]) => v === change.table
    )?.[0];
    if (!localTable) continue;

    const table = db.table(localTable);
    for (const record of change.records as { id: string }[]) {
      await table.update(record.id, {
        sync_status: 'synced',
        synced_at: new Date().toISOString(),
      });
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

export function getPendingCount(): Promise<number> {
  const counts = Object.keys(tableToApiName).map(async (tableName) => {
    const table = db.table(tableName);
    return table.where('sync_status').equals('pending').count();
  });
  return Promise.all(counts).then((c) => c.reduce((a, b) => a + b, 0));
}
