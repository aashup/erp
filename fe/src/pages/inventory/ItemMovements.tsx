import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ColumnDef } from '@tanstack/react-table';
import { stockLedgerApi, itemsApi, godownsApi } from '@/api/inventory';
import type { StockLedgerEntry } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';

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

export default function ItemMovements() {
  usePageTitle('Item Movements');
  const { itemId: paramItemId } = useParams<{ itemId: string }>();
  const [selectedItem, setSelectedItem] = useState(paramItemId ?? '');
  const [godownFilter, setGodownFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const activeItemId = selectedItem || paramItemId || '';

  const { data, isLoading } = useQuery({
    queryKey: ['item-movements', activeItemId, godownFilter, fromDate, toDate, page],
    queryFn: () => stockLedgerApi.itemMovements(activeItemId, {
      page: String(page),
      per_page: '50',
      ...(godownFilter ? { godown_id: godownFilter } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    enabled: !!activeItemId,
    select: (res) => res.data,
  });

  const currentItem = itemsData?.data?.find((i) => i.id === activeItemId);

  // Calculate running balance
  const movementsWithBalance = (data?.data ?? []).map((entry, index, arr) => {
    const runningBalance = arr.slice(0, index + 1).reduce((sum, e) => sum + Number(e.quantity), 0);
    return { ...entry, runningBalance };
  });

  // Summary stats
  const totalIn = (data?.data ?? []).filter((e) => Number(e.quantity) > 0).reduce((s, e) => s + Number(e.quantity), 0);
  const totalOut = (data?.data ?? []).filter((e) => Number(e.quantity) < 0).reduce((s, e) => s + Math.abs(Number(e.quantity)), 0);
  const closing = totalIn - totalOut;

  const columns: ColumnDef<StockLedgerEntry & { runningBalance: number }, unknown>[] = [
    { accessorKey: 'created_at', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN') },
    {
      accessorKey: 'type', header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as string;
        return <Badge variant={typeVariant[t] ?? 'default'}>{typeLabel[t] ?? t}</Badge>;
      },
    },
    { header: 'Godown', cell: ({ row }) => row.original.godown?.name ?? '—' },
    {
      accessorKey: 'quantity', header: 'Qty',
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return <span className={v >= 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{v > 0 ? '+' : ''}{v}</span>;
      },
    },
    { accessorKey: 'rate', header: 'Rate', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'value', header: 'Value', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    {
      accessorKey: 'runningBalance', header: 'Balance',
      cell: ({ getValue }) => <span className="font-semibold">{Number(getValue()).toFixed(2)}</span>,
    },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => <span className="max-w-[150px] truncate block">{(getValue() as string) ?? '—'}</span> },
  ];

  const selectClass = "rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm";
  const inputClass = "rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Item Movements {currentItem ? `— ${currentItem.name}` : ''}
      </h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            {!paramItemId && (
              <select className={selectClass} value={selectedItem} onChange={(e) => { setSelectedItem(e.target.value); setPage(1); }}>
                <option value="">Select Item</option>
                {(itemsData?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku ?? ''})</option>)}
              </select>
            )}
            <select className={selectClass} value={godownFilter} onChange={(e) => { setGodownFilter(e.target.value); setPage(1); }}>
              <option value="">All Godowns</option>
              {(godownsData?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input type="date" className={inputClass} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            <input type="date" className={inputClass} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>

        {activeItemId && data && (data.data ?? []).length > 0 && (
          <CardContent>
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">Total In: </span><span className="font-semibold text-green-600 dark:text-green-400">+{totalIn.toFixed(2)}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">Total Out: </span><span className="font-semibold text-red-600 dark:text-red-400">-{totalOut.toFixed(2)}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">Closing: </span><span className="font-bold text-gray-900 dark:text-gray-100">{closing.toFixed(2)}</span></div>
            </div>
          </CardContent>
        )}

        {!activeItemId ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Select an item to view movements</div>
        ) : (
          <>
            <DataTable columns={columns} data={movementsWithBalance} loading={isLoading} />
            {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
