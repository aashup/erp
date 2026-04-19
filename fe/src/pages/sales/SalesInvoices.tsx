import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { salesInvoicesApi } from '@/api/sales';
import { partiesApi } from '@/api/parties';
import { companySettingsApi } from '@/api/settings';
import { thermalTemplatesApi } from '@/api/thermalTemplates';
import { paymentReceiptsApi, reportsApi, ledgersApi } from '@/api/accounting';
import type { SalesInvoice, Party, ThermalTemplate } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Plus, Filter, Pencil, Trash2, Printer, Download, ArrowUp, ArrowDown, Eye, Banknote, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDateStore } from '@/store/dateStore';

const receiptSchema = z.object({
  account_ledger_id: z.string().min(1, 'Account is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  payment_mode: z.enum(['cash', 'bank', 'cheque', 'upi', 'other']),
  payment_date: z.string().min(1, 'Date is required'),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

type ReceiptForm = z.infer<typeof receiptSchema>;

function generateReceiptNumber() {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `REC-${yyyymmdd}-${rand}`;
}

interface ReceiptDialogProps {
  invoice: SalesInvoice;
  onClose: () => void;
  onSuccess: () => void;
}

function ReceiptDialog({ invoice, onClose, onSuccess }: ReceiptDialogProps) {
  const { selectedDate } = useDateStore();
  const { data: partyLedgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['party-ledger-balance', invoice.party_id],
    queryFn: () => reportsApi.partyLedger({ party_id: invoice.party_id }),
    select: (res) => res.data,
  });

  const { data: accountLedgers, isLoading: accountsLoading } = useQuery({
    queryKey: ['cash-bank-ledgers'],
    queryFn: () => ledgersApi.list({ group_system_key: 'cash_account,bank_account', per_page: '100' }),
    select: (res) => res.data,
  });

  const createReceipt = useMutation({
    mutationFn: (data: {
      party_id: string;
      type: 'receipt';
      receipt_number: string;
      receipt_date: string;
      amount: number;
      payment_mode: 'cash' | 'bank' | 'cheque' | 'upi' | 'other';
      sales_invoice_id: string;
      reference_number?: string;
      bank_name?: string;
      notes?: string;
    }) => paymentReceiptsApi.create(data),
    onSuccess: () => {
      toast.success('Receipt recorded successfully');
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Receipt failed';
      toast.error(msg);
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ReceiptForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(receiptSchema) as any,
    defaultValues: {
      amount: invoice.balance_due,
      payment_mode: 'cash',
      payment_date: selectedDate,
      reference_number: '',
      bank_name: '',
      notes: `Receipt for invoice ${invoice.invoice_number}`,
    },
  });

  const paymentMode = watch('payment_mode');
  const amount = watch('amount');

  const accountOptions = (accountLedgers?.data ?? []).map((l) => ({
    value: l.id,
    label: `${l.name}${l.group ? ` (${l.group.name})` : ''}`,
  }));

  const onSubmit = (formData: ReceiptForm) => {
    if (formData.amount > invoice.balance_due) {
      toast.error(`Amount cannot exceed balance due of ${formatCurrency(invoice.balance_due)}`);
      return;
    }
    createReceipt.mutate({
      party_id: invoice.party_id,
      type: 'receipt',
      receipt_number: generateReceiptNumber(),
      receipt_date: formData.payment_date,
      amount: formData.amount,
      payment_mode: formData.payment_mode,
      sales_invoice_id: invoice.id,
      reference_number: formData.reference_number || undefined,
      bank_name: formData.bank_name || undefined,
      notes: formData.notes || undefined,
    });
  };

  const partyName = invoice.party?.name ?? 'Customer';
  const closingBalance = partyLedgerData?.closing_balance ?? 0;
  const recentTxns = (partyLedgerData?.data ?? []).slice(-5).reverse();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Invoice summary */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Invoice</span>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="text-gray-500 dark:text-gray-400">Invoice #</div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{invoice.invoice_number}</div>
          <div className="text-gray-500 dark:text-gray-400">Customer</div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{partyName}</div>
          <div className="text-gray-500 dark:text-gray-400">Date</div>
          <div className="text-gray-900 dark:text-gray-100">{formatDate(invoice.invoice_date)}</div>
          <div className="text-gray-500 dark:text-gray-400">Invoice Total</div>
          <div className="text-gray-900 dark:text-gray-100">{formatCurrency(invoice.grand_total)}</div>
          <div className="text-gray-500 dark:text-gray-400">Amount Received</div>
          <div className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(invoice.amount_paid)}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Invoice Balance Due
          </span>
          <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(invoice.balance_due)}</span>
        </div>
      </div>

      {/* Customer outstanding balance */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {partyName} — Outstanding Balance
          </span>
          {ledgerLoading && <span className="text-xs text-gray-400">Loading…</span>}
          {!ledgerLoading && (
            <span className={`text-sm font-bold ${closingBalance > 0 ? 'text-blue-600 dark:text-blue-400' : closingBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
              {formatCurrency(Math.abs(closingBalance))} {closingBalance > 0 ? 'Dr (Receivable)' : closingBalance < 0 ? 'Cr (Advance)' : 'Nil'}
            </span>
          )}
        </div>
        {recentTxns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Voucher</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Dr</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Cr</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Balance</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{formatDate(row.voucher_date)}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[140px] truncate" title={row.narration}>{row.voucher_number}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Math.abs(row.balance))} {row.balance > 0 ? 'Dr' : row.balance < 0 ? 'Cr' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!ledgerLoading && recentTxns.length === 0 && (
          <div className="px-4 py-3 text-xs text-gray-400 text-center">No transactions found</div>
        )}
      </div>

      {/* Receipt form */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Receipt Details</span>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <SlideSelect
                name="account_ledger_id"
                label="Deposit Account"
                placeholder={accountsLoading ? 'Loading accounts…' : 'Select cash / bank account'}
                panelTitle="Select Deposit Account"
                options={accountOptions}
                value={watch('account_ledger_id')}
                onChange={(val) => {
                  setValue('account_ledger_id', val, { shouldValidate: true });
                  const ledger = (accountLedgers?.data ?? []).find((l) => l.id === val);
                  if (ledger?.group?.name?.toLowerCase().includes('bank')) {
                    setValue('payment_mode', 'bank');
                  } else {
                    setValue('payment_mode', 'cash');
                  }
                }}
                error={errors.account_ledger_id?.message}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Mode</label>
              <select
                {...register('payment_mode')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Input
              id="payment_date"
              label="Receipt Date"
              type="date"
              error={errors.payment_date?.message}
              {...register('payment_date')}
            />

            <div className="col-span-2">
              <Input
                id="amount"
                label={`Amount (₹) — max ${formatCurrency(invoice.balance_due)}`}
                type="number"
                step="0.01"
                min={0.01}
                max={invoice.balance_due}
                error={errors.amount?.message}
                {...register('amount')}
              />
              {amount > 0 && amount < invoice.balance_due && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Partial receipt — remaining balance will be {formatCurrency(invoice.balance_due - Number(amount))}
                </p>
              )}
            </div>

            {(paymentMode === 'bank' || paymentMode === 'cheque') && (
              <>
                <Input
                  id="bank_name"
                  label="Bank Name"
                  error={errors.bank_name?.message}
                  {...register('bank_name')}
                />
                <Input
                  id="reference_number"
                  label={paymentMode === 'cheque' ? 'Cheque Number' : 'Transaction Ref #'}
                  error={errors.reference_number?.message}
                  {...register('reference_number')}
                />
              </>
            )}

            {paymentMode === 'upi' && (
              <div className="col-span-2">
                <Input
                  id="reference_number"
                  label="UPI Reference / Transaction ID"
                  error={errors.reference_number?.message}
                  {...register('reference_number')}
                />
              </div>
            )}

            <div className="col-span-2">
              <Input
                id="notes"
                label="Narration / Notes"
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={createReceipt.isPending}>
          <Banknote className="mr-2 h-4 w-4" /> Receive Payment
        </Button>
      </div>
    </form>
  );
}

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



export default function SalesInvoices() {
  usePageTitle('Sales Invoices');
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
  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<SalesInvoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  const { data: thermalTemplates } = useQuery({
    queryKey: ['thermal-templates'],
    queryFn: () => thermalTemplatesApi.list({ per_page: '100' }),
    select: (res) => res.data.data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sales-invoices', page, search, dateFrom, dateTo, customerFilter, statusFilter, sortBy, sortOrder],
    queryFn: () => salesInvoicesApi.list({
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

  const thermalPaperSize = (companySettings?.thermal_printer_paper_size ?? '2inch') as '2inch' | '3inch';

  const getThermalTemplate = () => {
    // Check if custom template exists for this paper size
    const customTemplate = (thermalTemplates ?? []).find(
      (t: ThermalTemplate) => t.paper_size === thermalPaperSize && t.is_default
    );
    return customTemplate;
  };

  const thermalPreviewMutation = useMutation({
    mutationFn: (id: string) => {
      const customTemplate = getThermalTemplate();
      if (customTemplate) {
        // Use custom template
        return fetch(`/api/v1/sales-invoices/${id}/html?template=thermal-custom&paper_size=${thermalPaperSize}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }).then(res => res.text()).then(data => ({ data }));
      } else {
        // Use built-in thermal template
        return salesInvoicesApi.getThermalHtml(id, thermalPaperSize);
      }
    },
    onSuccess: (response) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for printing.');
        return;
      }
      printWindow.document.write(response.data);
      printWindow.document.close();
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
    },
    onError: () => {
      toast.error('Failed to open thermal preview');
    },
  });

  const thermalPrintMutation = useMutation({
    mutationFn: (id: string) => {
      const customTemplate = getThermalTemplate();
      if (customTemplate) {
        // Use custom template
        return fetch(`/api/v1/sales-invoices/${id}/html?template=thermal-custom&paper_size=${thermalPaperSize}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }).then(res => res.text()).then(data => ({ data }));
      } else {
        // Use built-in thermal template
        return salesInvoicesApi.getThermalHtml(id, thermalPaperSize);
      }
    },
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
      toast.error('Failed to print thermal invoice');
    },
  });

  const bulkCancelMutation = useMutation({
    mutationFn: (ids: string[]) => salesInvoicesApi.bulkCancel(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
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

  const columns: ColumnDef<SalesInvoice, unknown>[] = [
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
      id: 'customer',
      header: () => (
        <button
          onClick={() => handleSort('customer')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by customer"
        >
          Customer
          {renderSortIcon('customer')}
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
          <span className={bal > 0 ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}>
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
        const currentStatus = row.original.status ?? 'confirmed';
        return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;

        // Status change dropdown — commented out (invoices default to confirmed)
        // const transitions = allowedTransitions[currentStatus] ?? [];
        // if (transitions.length === 0) {
        //   return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;
        // }
        // return (
        //   <select
        //     value={currentStatus}
        //     onChange={(event) => handleStatusChange(row.original, event.target.value)}
        //     className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
        //     disabled={statusMutation.isPending}
        //   >
        //     <option value={currentStatus}>{statusLabels[currentStatus] ?? currentStatus}</option>
        //     {transitions.map((status) => (
        //       <option key={status} value={status}>
        //         {statusLabels[status] ?? status}
        //       </option>
        //     ))}
        //   </select>
        // );
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
            <div className="group relative">
              <button
                onClick={() => thermalPreviewMutation.mutate(row.original.id)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Thermal Preview"
                disabled={thermalPreviewMutation.isPending}
              >
                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                Thermal Preview
              </span>
            </div>
            <div className="group relative">
              <button
                onClick={() => thermalPrintMutation.mutate(row.original.id)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Print to Thermal"
                disabled={thermalPrintMutation.isPending}
              >
                <Printer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                Print to Thermal
              </span>
            </div>
            {isDraft && canEdit && (
              <button
                onClick={() => navigate(`/sales/invoices/${row.original.id}/edit`)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {isDraft && canDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this invoice?')) {
                    deleteMutation.mutate(row.original.id);
                  }
                }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
            <button
              onClick={() => setReceiptInvoice(row.original)}
              className="rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title={row.original.balance_due > 0 ? 'Receive Payment' : 'Fully received'}
              disabled={row.original.balance_due <= 0}
            >
              <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <Button variant="secondary" onClick={() => navigate('/sales/invoices/new-2')}>
              <Plus className="mr-2 h-4 w-4" /> SI-2
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => navigate('/sales/invoices/new')}>
              <Plus className="mr-2 h-4 w-4" /> New Invoice
            </Button>
          )}
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
        {data && (
          <Pagination
            currentPage={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={setPage}
          />
        )}
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

        {/* Customer Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Customer
            </label>
            {customerFilter && (
              <button onClick={() => { setCustomerFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
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
            mapFn={(p: Party) => ({ value: p.id, label: p.name })}
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
            setCustomerFilter('');
            setStatusFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>

      {/* Receive Payment Modal */}
      {receiptInvoice && (
        <Modal
          open={!!receiptInvoice}
          onClose={() => setReceiptInvoice(null)}
          title={`Receive Payment — ${receiptInvoice.invoice_number}`}
          size="lg"
        >
          <ReceiptDialog
            invoice={receiptInvoice}
            onClose={() => setReceiptInvoice(null)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales-invoices'] })}
          />
        </Modal>
      )}
    </div>
  );
}
