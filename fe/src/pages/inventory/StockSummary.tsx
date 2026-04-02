import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ColumnDef } from '@tanstack/react-table';
import { stockLedgerApi, godownsApi } from '@/api/inventory';
import type { StockSummaryRow } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Search } from 'lucide-react';

export default function StockSummary() {
  usePageTitle('Stock Summary');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [godownFilter, setGodownFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-summary', page, search, godownFilter],
    queryFn: () => stockLedgerApi.summary({ page: String(page), search, per_page: '25', ...(godownFilter ? { godown_id: godownFilter } : {}) }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const columns: ColumnDef<StockSummaryRow, unknown>[] = [
    { header: 'Item', cell: ({ row }) => row.original.item?.name ?? '—' },
    { header: 'SKU', cell: ({ row }) => row.original.item?.sku ?? '—' },
    { header: 'Unit', cell: ({ row }) => row.original.item?.unit ?? '—' },
    { header: 'Godown', cell: ({ row }) => row.original.godown?.name ?? '—' },
    {
      accessorKey: 'current_stock',
      header: 'Current Stock',
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className="font-semibold">{Number(v).toFixed(2)}</span>;
      },
    },
    {
      header: 'Reorder Level',
      cell: ({ row }) => row.original.item?.reorder_level ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const reorder = row.original.item?.reorder_level;
        const stock = Number(row.original.current_stock);
        if (!reorder) return <Badge>N/A</Badge>;
        if (stock <= 0) return <Badge variant="danger">Out of Stock</Badge>;
        if (stock < reorder) return <Badge variant="warning">Low Stock</Badge>;
        return <Badge variant="success">OK</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Summary</h1>
      </div>
      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="Search items..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm"
              value={godownFilter}
              onChange={(e) => { setGodownFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Godowns</option>
              {(godownsData?.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          onRowClick={(row) => navigate(`/inventory/items/${row.item_id}/movements`)}
        />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
