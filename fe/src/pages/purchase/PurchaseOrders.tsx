import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { purchaseOrdersApi } from '@/api/purchase';
import { partiesApi } from '@/api/parties';
import type { PurchaseOrder } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown, PackageCheck } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { ReceiveItemsDialog } from './ReceiveItemsDialog';

const statusVariant: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  confirmed: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'danger',
};

const allowedTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  partially_received: ['cancelled'],
  received: [],
  cancelled: [],
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export default function PurchaseOrders() {
  usePageTitle('Purchase Orders');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('purchase.create');
  const canEdit = hasPermission('purchase.edit');
  const canDelete = hasPermission('purchase.delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [sortBy, setSortBy] = useState('po_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search, dateFrom, dateTo, vendorFilter, statusFilter, sortBy, sortOrder],
    queryFn: () => purchaseOrdersApi.list({
      page: String(page),
      search,
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(vendorFilter ? { party_id: vendorFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    select: (res) => res.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Purchase order deleted'); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseOrdersApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success(res.data?.message ?? 'Status updated');
    },
  });

  const fetchPoForReceive = async (po: PurchaseOrder) => {
    const res = await purchaseOrdersApi.get(po.id);
    setReceivingPo(res.data.data);
  };

  const handleStatusChange = (po: PurchaseOrder, newStatus: string) => {
    if (newStatus === po.status) return;
    const label = statusLabels[newStatus] ?? newStatus;
    const confirmMsg = newStatus === 'confirmed'
      ? `Confirm PO "${po.po_number}"? This will mark it ready for goods receiving.`
      : newStatus === 'cancelled'
        ? `Cancel PO "${po.po_number}"? This cannot be undone.`
        : `Change status of "${po.po_number}" to "${label}"?`;
    if (confirm(confirmMsg)) {
      statusMutation.mutate({ id: po.id, status: newStatus });
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

  const columns: ColumnDef<PurchaseOrder, unknown>[] = [
    {
      id: 'po_number',
      header: () => (
        <button onClick={() => handleSort('po_number')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          PO # {renderSortIcon('po_number')}
        </button>
      ),
      accessorKey: 'po_number',
    },
    {
      id: 'vendor_name',
      header: () => (
        <button onClick={() => handleSort('vendor_name')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Vendor {renderSortIcon('vendor_name')}
        </button>
      ),
      cell: ({ row }) => row.original.party?.name ?? '—',
    },
    {
      id: 'po_date',
      header: () => (
        <button onClick={() => handleSort('po_date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Date {renderSortIcon('po_date')}
        </button>
      ),
      cell: ({ row }) => formatDate(row.original.po_date),
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
        const po = row.original;
        const transitions = allowedTransitions[po.status] ?? [];
        if (transitions.length === 0) {
          return <Badge variant={statusVariant[po.status] ?? 'default'}>{statusLabels[po.status] ?? po.status}</Badge>;
        }
        return (
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-1 px-2 text-xs font-medium focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={po.status}
            disabled={statusMutation.isPending}
            onChange={(e) => handleStatusChange(po, e.target.value)}
          >
            <option value={po.status}>{statusLabels[po.status]}</option>
            {transitions.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        );
      },
    },
    ...(canEdit || canDelete ? [{
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: PurchaseOrder } }) => {
        const po = row.original;
        const isDraft = po.status === 'draft';
        const canReceive = (po.status === 'confirmed' || po.status === 'partially_received') && canEdit;
        return (
          <div className="flex items-center gap-1">
            {canReceive && (
              <button
                onClick={() => fetchPoForReceive(po)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Receive Items"
              >
                <PackageCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              </button>
            )}
            {isDraft && canEdit && (
              <button
                onClick={() => navigate(`/purchase/orders/${po.id}/edit`)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {isDraft && canDelete && (
              <button
                onClick={() => { if (confirm('Delete this PO?')) deleteMutation.mutate(po.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    } as ColumnDef<PurchaseOrder, unknown>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <Button onClick={() => navigate('/purchase/orders/new')}>
              <Plus className="mr-2 h-4 w-4" /> New PO
            </Button>
          )}
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {receivingPo && (
        <ReceiveItemsDialog
          po={receivingPo}
          open={!!receivingPo}
          onClose={() => setReceivingPo(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
            setReceivingPo(null);
          }}
        />
      )}

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
            placeholder="Search PO..."
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

        {/* Vendor Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Vendor</label>
            {vendorFilter && (
              <button onClick={() => { setVendorFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Clear</button>
            )}
          </div>
          <SlideSelect
            name="vendorFilter"
            placeholder="All Vendors"
            panelTitle="Filter by Vendor"
            value={vendorFilter}
            onChange={(val) => { setVendorFilter(val); setPage(1); }}
            queryKey={['parties-all']}
            queryFn={(params) => partiesApi.list({ ...params, per_page: '500', type: 'vendor' })}
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
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setVendorFilter(''); setStatusFilter(''); setPage(1); }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
    </div>
  );
}
