import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { salesInvoicesApi } from '@/api/sales';
import type { SalesInvoice } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const statusVariant: Record<string, 'default' | 'success' | 'danger'> = {
  draft: 'default',
  confirmed: 'success',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

const allowedTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
};

export default function SalesInvoices() {
  usePageTitle('Sales Invoices');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-invoices', page, search],
    queryFn: () => salesInvoicesApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesInvoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('Sales invoice deleted');
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: (id: string) => salesInvoicesApi.downloadPdf(id),
    onSuccess: (response, id) => {
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('PDF downloaded');
    },
    onError: () => {
      toast.error('Failed to download PDF');
    },
  });

  const printMutation = useMutation({
    mutationFn: (id: string) => salesInvoicesApi.getHtml(id),
    onSuccess: (response) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for printing.');
        return;
      }
      printWindow.document.write(response.data);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
    },
    onError: () => {
      toast.error('Failed to open print preview');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesInvoicesApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success(res.data.message ?? 'Status updated');
    },
  });

  const handleStatusChange = (invoice: SalesInvoice, newStatus: string) => {
    const messages: Record<string, string> = {
      confirmed: 'Confirming will deduct stock from inventory. Continue?',
      cancelled: 'Are you sure you want to cancel this invoice? Stock will be reversed if previously confirmed.',
    };

    if (confirm(messages[newStatus] ?? `Change status to ${newStatus}?`)) {
      statusMutation.mutate({ id: invoice.id, status: newStatus });
    }
  };

  const columns: ColumnDef<SalesInvoice, unknown>[] = [
    { accessorKey: 'invoice_number', header: 'Invoice #' },
    { header: 'Customer', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'invoice_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'grand_total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'balance_due', header: 'Balance', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const currentStatus = row.original.status ?? 'draft';
        const transitions = allowedTransitions[currentStatus] ?? [];

        if (transitions.length === 0) {
          return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;
        }

        return (
          <select
            value={currentStatus}
            onChange={(event) => handleStatusChange(row.original, event.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
            disabled={statusMutation.isPending}
          >
            <option value={currentStatus}>{statusLabels[currentStatus] ?? currentStatus}</option>
            {transitions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status] ?? status}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isDraft = row.original.status === 'draft';
        return (
          <div className="flex items-center gap-1">
            <div className="group relative">
              <button
                onClick={() => downloadPdfMutation.mutate(row.original.id)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Download Invoice"
                disabled={downloadPdfMutation.isPending}
              >
                <Download className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                Download PDF
              </span>
            </div>
            <div className="group relative">
              <button
                onClick={() => printMutation.mutate(row.original.id)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Print Invoice"
                disabled={printMutation.isPending}
              >
                <Printer className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                Print Invoice
              </span>
            </div>
            {isDraft && (
              <>
                <button
                  onClick={() => navigate(`/sales/invoices/${row.original.id}/edit`)}
                  className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this invoice?')) {
                      deleteMutation.mutate(row.original.id);
                    }
                  }}
                  className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales Invoices</h1>
        <Button onClick={() => navigate('/sales/invoices/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Search invoice..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && (
          <Pagination
            currentPage={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
