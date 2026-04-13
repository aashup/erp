import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { purchaseInvoicesApi } from '@/api/purchase';
import { partiesApi } from '@/api/parties';
import { paymentReceiptsApi, reportsApi, ledgersApi } from '@/api/accounting';
import type { PurchaseInvoice } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown, CreditCard, TrendingDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';
import toast from 'react-hot-toast';
import { useDateStore } from '@/store/dateStore';

const statusVariant: Record<string, 'default' | 'success' | 'danger'> = {
  draft: 'default',
  confirmed: 'success',
  cancelled: 'danger',
};

const paymentSchema = z.object({
  account_ledger_id: z.string().min(1, 'Account is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  payment_mode: z.enum(['cash', 'bank', 'cheque', 'upi', 'other']),
  payment_date: z.string().min(1, 'Date is required'),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

function generatePaymentNumber() {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PAY-${yyyymmdd}-${rand}`;
}

interface PaymentDialogProps {
  invoice: PurchaseInvoice;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentDialog({ invoice, onClose, onSuccess }: PaymentDialogProps) {
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

  const createPayment = useMutation({
    mutationFn: (data: {
      party_id: string;
      type: 'payment';
      receipt_number: string;
      receipt_date: string;
      amount: number;
      payment_mode: 'cash' | 'bank' | 'cheque' | 'upi' | 'other';
      purchase_invoice_id: string;
      reference_number?: string;
      bank_name?: string;
      notes?: string;
    }) => paymentReceiptsApi.create(data),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Payment failed';
      toast.error(msg);
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      amount: invoice.balance_due,
      payment_mode: 'cash',
      payment_date: selectedDate,
      reference_number: '',
      bank_name: '',
      notes: `Payment for invoice ${invoice.invoice_number}`,
    },
  });

  const paymentMode = watch('payment_mode');
  const amount = watch('amount');

  const accountOptions = (accountLedgers?.data ?? []).map((l) => ({
    value: l.id,
    label: `${l.name}${l.group ? ` (${l.group.name})` : ''}`,
  }));

  const onSubmit = (formData: PaymentForm) => {
    if (formData.amount > invoice.balance_due) {
      toast.error(`Amount cannot exceed balance due of ${formatCurrency(invoice.balance_due)}`);
      return;
    }
    createPayment.mutate({
      party_id: invoice.party_id,
      type: 'payment',
      receipt_number: generatePaymentNumber(),
      receipt_date: formData.payment_date,
      amount: formData.amount,
      payment_mode: formData.payment_mode,
      purchase_invoice_id: invoice.id,
      reference_number: formData.reference_number || undefined,
      bank_name: formData.bank_name || undefined,
      notes: formData.notes || undefined,
    });
  };

  const partyName = invoice.party?.name ?? 'Vendor';
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
          <div className="text-gray-500 dark:text-gray-400">Vendor</div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{partyName}</div>
          <div className="text-gray-500 dark:text-gray-400">Date</div>
          <div className="text-gray-900 dark:text-gray-100">{formatDate(invoice.invoice_date)}</div>
          <div className="text-gray-500 dark:text-gray-400">Invoice Total</div>
          <div className="text-gray-900 dark:text-gray-100">{formatCurrency(invoice.grand_total)}</div>
          <div className="text-gray-500 dark:text-gray-400">Amount Paid</div>
          <div className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(invoice.amount_paid)}</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Invoice Balance Due
          </span>
          <span className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(invoice.balance_due)}</span>
        </div>
      </div>

      {/* Party outstanding balance */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {partyName} — Outstanding Balance
          </span>
          {ledgerLoading && <span className="text-xs text-gray-400">Loading…</span>}
          {!ledgerLoading && (
            <span className={`text-sm font-bold ${closingBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(Math.abs(closingBalance))} {closingBalance > 0 ? 'Cr (You Owe)' : closingBalance < 0 ? 'Dr (Advance)' : 'Nil'}
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
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Math.abs(row.balance))} {row.balance > 0 ? 'Cr' : row.balance < 0 ? 'Dr' : ''}</td>
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

      {/* Payment form */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Payment Details</span>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <SlideSelect
                name="account_ledger_id"
                label="Payment Account"
                placeholder={accountsLoading ? 'Loading accounts…' : 'Select cash / bank account'}
                panelTitle="Select Payment Account"
                options={accountOptions}
                value={watch('account_ledger_id')}
                onChange={(val) => {
                  setValue('account_ledger_id', val, { shouldValidate: true });
                  // auto-set payment mode based on account name
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
              label="Payment Date"
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
                  Partial payment — remaining balance will be {formatCurrency(invoice.balance_due - Number(amount))}
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
        <Button type="submit" loading={createPayment.isPending}>
          <CreditCard className="mr-2 h-4 w-4" /> Make Payment
        </Button>
      </div>
    </form>
  );
}

export default function PurchaseInvoices() {
  usePageTitle('Purchase Invoices');
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
  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<PurchaseInvoice | null>(null);

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

  const columns: ColumnDef<PurchaseInvoice, unknown>[] = [
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
            <button
              onClick={() => setPaymentInvoice(inv)}
              className="rounded p-1 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title={inv.balance_due > 0 ? 'Make a Payment' : 'Fully paid'}
              disabled={inv.balance_due <= 0}
            >
              <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
            </button>
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
          {canCreate && <Button onClick={() => navigate('/purchase/invoices/new')}><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>}
        </div>
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

      {/* Make Payment Modal */}
      {paymentInvoice && (
        <Modal
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          title={`Make Payment — ${paymentInvoice.invoice_number}`}
          size="lg"
        >
          <PaymentDialog
            invoice={paymentInvoice}
            onClose={() => setPaymentInvoice(null)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] })}
          />
        </Modal>
      )}
    </div>
  );
}
