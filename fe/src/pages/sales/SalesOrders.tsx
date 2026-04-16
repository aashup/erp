import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { salesOrdersApi } from '@/api/sales';
import { partiesApi } from '@/api/parties';
import type { SalesOrder } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const statusVariant: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  confirmed: 'info',
  partially_delivered: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_delivered: 'Partially Delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const allowedTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['partially_delivered', 'delivered', 'cancelled'],
  partially_delivered: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export default function SalesOrders() {
  usePageTitle('Sales Orders');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('sales.create');
  const canEdit = hasPermission('sales.edit');
  const canDelete = hasPermission('sales.delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('so_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, search, dateFrom, dateTo, customerFilter, statusFilter, sortBy, sortOrder],
    queryFn: () => salesOrdersApi.list({
      page: String(page),
      search,
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(customerFilter ? { party_id: customerFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    select: (res) => res.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesOrdersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('Sales order deleted'); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesOrdersApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(res.data.message ?? 'Status updated');
    },
  });

  const handleStatusChange = (so: SalesOrder, newStatus: string) => {
    const messages: Record<string, string> = {
      confirmed: 'Confirming will auto-create a Sales Invoice and deduct stock. Continue?',
      cancelled: 'Are you sure you want to cancel this sales order?',
      delivered: 'Mark this order as fully delivered?',
      partially_delivered: 'Mark this order as partially delivered?',
    };
    if (confirm(messages[newStatus] ?? `Change status to ${newStatus}?`)) {
      statusMutation.mutate({ id: so.id, status: newStatus });
    }
  };

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

  const columns: ColumnDef<SalesOrder, unknown>[] = [
    {
      id: 'so_number',
      header: () => (
        <button onClick={() => handleSort('so_number')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          SO # {renderSortIcon('so_number')}
        </button>
      ),
      accessorKey: 'so_number',
    },
    {
      id: 'customer',
      header: () => (
        <button onClick={() => handleSort('customer')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Customer {renderSortIcon('customer')}
        </button>
      ),
      cell: ({ row }) => row.original.party?.name ?? '—',
    },
    {
      id: 'so_date',
      header: () => (
        <button onClick={() => handleSort('so_date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Date {renderSortIcon('so_date')}
        </button>
      ),
      cell: ({ row }) => formatDate(row.original.so_date),
    },
    {
      id: 'grand_total',
      header: () => (
        <button onClick={() => handleSort('grand_total')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Total {renderSortIcon('grand_total')}
        </button>
      ),
      cell: ({ row }) => formatCurrency(row.original.grand_total),
    },
    {
      id: 'status',
      header: () => (
        <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Status {renderSortIcon('status')}
        </button>
      ),
      cell: ({ row }) => {
        const so = row.original;
        const currentStatus = so.status ?? 'draft';
        const transitions = allowedTransitions[currentStatus] ?? [];
        if (transitions.length === 0) {
          return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;
        }
        return (
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(so, e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-1 px-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={statusMutation.isPending}
          >
            <option value={currentStatus}>{statusLabels[currentStatus] ?? currentStatus}</option>
            {transitions.map((s) => (
              <option key={s} value={s}>{statusLabels[s] ?? s}</option>
            ))}
          </select>
        );
      },
    },
    ...(canEdit || canDelete ? [{
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: SalesOrder } }) => {
        const isDraft = row.original.status === 'draft';
        return (
          <div className="flex items-center gap-1">
            {isDraft && canEdit && (
              <button
                onClick={() => navigate(`/sales/orders/${row.original.id}/edit`)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {isDraft && canDelete && (
              <button
                onClick={() => { if (confirm('Delete this SO?')) deleteMutation.mutate(row.original.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    } as ColumnDef<SalesOrder, unknown>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <Button onClick={() => navigate('/sales/orders/new')}>
              <Plus className="mr-2 h-4 w-4" /> New SO
            </Button>
          )}
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      <FilterPanel open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
        {/* Search */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Clear</button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search SO..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Date Range */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Clear</button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </div>
          </div>
        </div>

        {/* Customer Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Customer</label>
            {customerFilter && (
              <button onClick={() => { setCustomerFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Clear</button>
            )}
          </div>
          <SlideSelect
            name="customerFilter"
            placeholder="All Customers"
            panelTitle="Filter by Customer"
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setPage(1); }}
            queryKey={['parties-all']}
            queryFn={(params) => partiesApi.list({ ...params, per_page: '500', type: 'customer' })}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mapFn={(p: any) => ({ value: p.id, label: p.name })}
          />
        </div>

        {/* Status Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Status</label>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Clear</button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="partially_delivered">Partially Delivered</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setCustomerFilter(''); setStatusFilter(''); setPage(1); }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
    </div>
  );
}
