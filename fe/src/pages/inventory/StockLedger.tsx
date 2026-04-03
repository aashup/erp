import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { stockLedgerApi, godownsApi, itemsApi } from '@/api/inventory';
import type { StockLedgerEntry } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Filter } from 'lucide-react';

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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Ledger</h1>
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Item Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Item
          </label>
          <select
            value={itemFilter}
            onChange={(e) => { setItemFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Items</option>
            {(itemsData?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>

        {/* Godown Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Godown
          </label>
          <select
            value={godownFilter}
            onChange={(e) => { setGodownFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Godowns</option>
            {(godownsData?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Types</option>
            {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range
          </label>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {(itemFilter || godownFilter || typeFilter || fromDate || toDate) && (
          <button
            type="button"
            onClick={() => { setItemFilter(''); setGodownFilter(''); setTypeFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-600/50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </FilterPanel>
    </div>
  );
}
