import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { stockLedgerApi, godownsApi, itemsApi } from '@/api/inventory';
import type { StockLedgerEntry } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';

const typeVariant: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  purchase: 'info',
  purchase_return: 'danger',
  sale: 'success',
  sale_return: 'warning',
  transfer_in: 'info',
  transfer_out: 'warning',
  adjustment: 'default',
  opening: 'default',
};

const typeLabel: Record<string, string> = {
  purchase: 'Purchase',
  purchase_return: 'Purchase Return',
  sale: 'Sale',
  sale_return: 'Sale Return',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment: 'Adjustment',
  opening: 'Opening',
};

export default function StockLedger() {
  usePageTitle('Stock Ledger');
  const [page, setPage] = useState(1);
  const [itemFilter, setItemFilter] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-ledger', page, itemFilter, godownFilter, typeFilter, fromDate, toDate],
    queryFn: () => stockLedgerApi.list({
      page: String(page),
      per_page: '25',
      ...(itemFilter ? { item_id: itemFilter } : {}),
      ...(godownFilter ? { godown_id: godownFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const columns: ColumnDef<StockLedgerEntry, unknown>[] = [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
    { header: 'Item', cell: ({ row }) => row.original.item?.name ?? '—' },
    { header: 'Godown', cell: ({ row }) => row.original.godown?.name ?? '—' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as string;
        return <Badge variant={typeVariant[t] ?? 'default'}>{typeLabel[t] ?? t}</Badge>;
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return <span className={v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{v > 0 ? '+' : ''}{v}</span>;
      },
    },
    { accessorKey: 'rate', header: 'Rate', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'value', header: 'Value', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => <span className="max-w-[200px] truncate block">{(getValue() as string) ?? '—'}</span> },
  ];

  const selectClass = "rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm";
  const inputClass = "rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Ledger</h1>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <select className={selectClass} value={itemFilter} onChange={(e) => { setItemFilter(e.target.value); setPage(1); }}>
              <option value="">All Items</option>
              {(itemsData?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select className={selectClass} value={godownFilter} onChange={(e) => { setGodownFilter(e.target.value); setPage(1); }}>
              <option value="">All Godowns</option>
              {(godownsData?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className={selectClass} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" className={inputClass} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            <input type="date" className={inputClass} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
            {(itemFilter || godownFilter || typeFilter || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setItemFilter(''); setGodownFilter(''); setTypeFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
