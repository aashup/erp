import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { purchaseInvoicesApi } from '@/api/purchase';
import { partiesApi } from '@/api/parties';
import type { PurchaseInvoice } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { OcrUploadDialog } from './OcrUploadDialog';
import { FilterPanel } from '@/components/ui/FilterPanel';
import toast from 'react-hot-toast';

const statusVariant: Record<string, 'default' | 'success' | 'danger'> = {
  draft: 'default',
  confirmed: 'success',
  cancelled: 'danger',
};

export default function PurchaseInvoices() {
  usePageTitle('Purchase Invoices');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('purchase.create');
  const canEdit = hasPermission('purchase.edit');
  const canDelete = hasPermission('purchase.delete');
  const [showOcrUpload, setShowOcrUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('invoice_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', page, search, dateFrom, dateTo, vendorFilter, statusFilter, sortBy, sortOrder],
    queryFn: () => purchaseInvoicesApi.list({
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
    mutationFn: (id: string) => purchaseInvoicesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }),
  });

  const bulkCancelMutation = useMutation({
    mutationFn: (ids: string[]) => purchaseInvoicesApi.bulkCancel(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      setSelectedIds(new Set());
      toast.success(res.data.data?.message ?? 'Invoices cancelled');
    },
    onError: () => toast.error('Failed to cancel invoices'),
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

  const invoiceRows = data?.data ?? [];
  const confirmIds = invoiceRows.filter((inv) => inv.status === 'confirmed').map((inv) => inv.id);
  const isAllSelected = confirmIds.length > 0 && confirmIds.every((id) => selectedIds.has(id));
  const isIndeterminate = !isAllSelected && confirmIds.some((id) => selectedIds.has(id));

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(confirmIds) : new Set());
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleBulkCancel = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (confirm(`Cancel ${ids.length} selected invoice(s)? This will reverse stock and delete journal entries.`)) {
      bulkCancelMutation.mutate(ids);
    }
  };

  const columns: ColumnDef<PurchaseInvoice, unknown>[] = [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      ),
      cell: ({ row }) => {
        const isConfirmed = row.original.status === 'confirmed';
        return (
          <input
            type="checkbox"
            disabled={!isConfirmed}
            checked={selectedIds.has(row.original.id)}
            onChange={(e) => handleSelectRow(row.original.id, e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-30"
          />
        );
      },
    },
    {
      id: 'invoice_number',
      header: () => (
        <button
          onClick={() => handleSort('invoice_number')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by invoice number"
        >
          Invoice #
          {renderSortIcon('invoice_number')}
        </button>
      ),
      accessorKey: 'invoice_number',
    },
    {
      id: 'vendor_invoice_number',
      header: () => (
        <button
          onClick={() => handleSort('vendor_invoice_number')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by vendor invoice number"
        >
          Vendor Inv #
          {renderSortIcon('vendor_invoice_number')}
        </button>
      ),
      accessorKey: 'vendor_invoice_number',
    },
    {
      id: 'vendor',
      header: () => (
        <button
          onClick={() => handleSort('vendor')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by vendor"
        >
          Vendor
          {renderSortIcon('vendor')}
        </button>
      ),
      cell: ({ row }) => row.original.party?.name ?? '—',
    },
    {
      id: 'invoice_date',
      header: () => (
        <button
          onClick={() => handleSort('invoice_date')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by date"
        >
          Date
          {renderSortIcon('invoice_date')}
        </button>
      ),
      cell: ({ row }) => formatDate(row.original.invoice_date),
    },
    {
      id: 'grand_total',
      header: () => (
        <button
          onClick={() => handleSort('grand_total')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by total"
        >
          Total
          {renderSortIcon('grand_total')}
        </button>
      ),
      cell: ({ row }) => formatCurrency(row.original.grand_total),
    },
    {
      id: 'balance_due',
      header: () => (
        <button
          onClick={() => handleSort('balance_due')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by balance"
        >
          Balance
          {renderSortIcon('balance_due')}
        </button>
      ),
      cell: ({ row }) => {
        const bal = row.original.balance_due;
        return (
          <span className={bal > 0 ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}>
            {formatCurrency(bal)}
          </span>
        );
      },
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
        const s = row.original.status;
        return <Badge variant={statusVariant[s] ?? 'default'}>{s}</Badge>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <button onClick={() => navigate(`/purchase/invoices/${inv.id}/edit`)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => { if (confirm('Delete this invoice?')) deleteMutation.mutate(inv.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <Button variant="secondary" onClick={() => setShowOcrUpload(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import from Image
            </Button>
          )}
          {canCreate && <Button onClick={() => navigate('/purchase/invoices/new')}><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>}
        </div>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 px-4 py-2">
          <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
            {selectedIds.size} invoice(s) selected
          </span>
          <button
            onClick={handleBulkCancel}
            disabled={bulkCancelMutation.isPending}
            className="ml-auto rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {bulkCancelMutation.isPending ? 'Cancelling…' : 'Cancel Selected'}
          </button>
        </div>
      )}

      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Search */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search invoice..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Date Range */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date Range
            </label>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Vendor Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Vendor
            </label>
            {vendorFilter && (
              <button onClick={() => { setVendorFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
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
            mapFn={(p: any) => ({ value: p.id, label: p.name })}
          />
        </div>

        {/* Status Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Status
            </label>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
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
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setDateFrom('');
            setDateTo('');
            setVendorFilter('');
            setStatusFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>

      {/* OCR Upload Dialog */}
      <OcrUploadDialog
        open={showOcrUpload}
        onClose={() => setShowOcrUpload(false)}
      />

    </div>
  );
}
