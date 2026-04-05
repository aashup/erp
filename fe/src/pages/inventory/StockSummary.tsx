import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ColumnDef } from '@tanstack/react-table';
import { stockLedgerApi, godownsApi } from '@/api/inventory';
import type { StockSummaryRow } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Filter, ArrowUp, ArrowDown } from 'lucide-react';

export default function StockSummary() {
  usePageTitle('Stock Summary');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const [sortBy, setSortBy] = useState('item_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-summary', page, search, godownFilter, sortBy, sortOrder],
    queryFn: () => stockLedgerApi.summary({ page: String(page), search, per_page: '25', sort_by: sortBy, sort_order: sortOrder, ...(godownFilter ? { godown_id: godownFilter } : {}) }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns: ColumnDef<StockSummaryRow, unknown>[] = [
    {
      id: 'item_name',
      header: () => (
        <button
          onClick={() => handleSort('item_name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by item name"
        >
          Item
          {renderSortIcon('item_name')}
        </button>
      ),
      cell: ({ row }) => row.original.item?.name ?? '—',
    },
    {
      id: 'sku',
      header: () => (
        <button
          onClick={() => handleSort('sku')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by SKU"
        >
          SKU
          {renderSortIcon('sku')}
        </button>
      ),
      cell: ({ row }) => row.original.item?.sku ?? '—',
    },
    {
      id: 'unit',
      header: () => (
        <button
          onClick={() => handleSort('unit')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by unit"
        >
          Unit
          {renderSortIcon('unit')}
        </button>
      ),
      cell: ({ row }) => row.original.item?.unit ?? '—',
    },
    {
      id: 'godown_name',
      header: () => (
        <button
          onClick={() => handleSort('godown_name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by godown"
        >
          Godown
          {renderSortIcon('godown_name')}
        </button>
      ),
      cell: ({ row }) => row.original.godown?.name ?? '—',
    },
    {
      id: 'current_stock',
      header: () => (
        <button
          onClick={() => handleSort('current_stock')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by current stock"
        >
          Current Stock
          {renderSortIcon('current_stock')}
        </button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className="font-semibold">{Number(v).toFixed(2)}</span>;
      },
    },
    {
      id: 'reorder_level',
      header: () => (
        <button
          onClick={() => handleSort('reorder_level')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by reorder level"
        >
          Reorder Level
          {renderSortIcon('reorder_level')}
        </button>
      ),
      cell: ({ row }) => row.original.item?.reorder_level ?? '—',
    },
    {
      id: 'status',
      header: () => (
        <button
          onClick={() => handleSort('status')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by status"
        >
          Status
          {renderSortIcon('status')}
        </button>
      ),
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
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          onRowClick={(row) => navigate(`/inventory/items/${row.item_id}/movements`)}
        />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Search */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
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
            {(godownsData?.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setGodownFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
    </div>
  );
}
