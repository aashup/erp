import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { vouchersApi, ledgersApi, paymentReceiptsApi } from '@/api/accounting';
import { partiesApi } from '@/api/parties';
import type { Voucher, PaymentReceipt } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSelectedFYId } from '@/hooks/useFinancialYear';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PaymentVoucherDetailModal } from '@/components/accounting/PaymentVoucherDetailModal';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Eye,
  X,
  Pencil,
  Trash2,
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  BookOpen,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { useDateStore } from '@/store/dateStore';

// ─── Voucher Type Definitions ───────────────────────────────────────────────

type VoucherTab = 'contra' | 'payment' | 'receipt' | 'journal' | 'sales' | 'purchase';

interface VoucherTypeConfig {
  key: VoucherTab;
  label: string;
  shortcut: string;
  shortcutKey: string; // actual key for event listener
  purpose: string;
  icon: typeof ArrowLeftRight;
  color: string;
  activeColor: string;
}

const VOUCHER_TYPES: VoucherTypeConfig[] = [
  {
    key: 'contra',
    label: 'Contra',
    shortcut: 'F4',
    shortcutKey: 'F4',
    purpose: 'Fund transfers between Cash and Bank or between two Bank accounts.',
    icon: ArrowLeftRight,
    color: 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20',
    activeColor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-400 dark:border-purple-600 ring-2 ring-purple-300 dark:ring-purple-700',
  },
  {
    key: 'payment',
    label: 'Payment',
    shortcut: 'F5',
    shortcutKey: 'F5',
    purpose: 'All types of payments (Cash/Bank) made to parties or for expenses.',
    icon: CreditCard,
    color: 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20',
    activeColor: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-400 dark:border-red-600 ring-2 ring-red-300 dark:ring-red-700',
  },
  {
    key: 'receipt',
    label: 'Receipt',
    shortcut: 'F6',
    shortcutKey: 'F6',
    purpose: 'All money received (Cash/Bank) from customers or other sources.',
    icon: HandCoins,
    color: 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20',
    activeColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-400 dark:border-green-600 ring-2 ring-green-300 dark:ring-green-700',
  },
  {
    key: 'journal',
    label: 'Journal',
    shortcut: 'F7',
    shortcutKey: 'F7',
    purpose: 'Adjustment entries, depreciation, and non-cash transactions.',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    activeColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-600 ring-2 ring-blue-300 dark:ring-blue-700',
  },
  {
    key: 'sales',
    label: 'Sales',
    shortcut: 'F8',
    shortcutKey: 'F8',
    purpose: 'Recording the sale of goods or services.',
    icon: Receipt,
    color: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    activeColor: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-300 dark:ring-emerald-700',
  },
  {
    key: 'purchase',
    label: 'Purchase',
    shortcut: 'F9',
    shortcutKey: 'F9',
    purpose: 'Recording the purchase of goods or services.',
    icon: ShoppingCart,
    color: 'text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    activeColor: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-400 dark:border-orange-600 ring-2 ring-orange-300 dark:ring-orange-700',
  },
];

// ─── Journal Entry Schema & Types ───────────────────────────────────────────

const journalLineSchema = z.object({
  ledger_id: z.string().min(1, 'Ledger required'),
  debit: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  credit: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  narration: z.string().optional(),
});

const journalSchema = z.object({
  voucher_date: z.string().min(1, 'Date is required'),
  voucher_type: z.enum(['journal', 'contra', 'payment', 'receipt', 'purchase', 'sales']),
  narration: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum1, l1) => sum1 + (Number(l1.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits', path: ['lines'] }
);

type JournalForm = z.infer<typeof journalSchema>;

// ─── Payment/Receipt Schema ─────────────────────────────────────────────────

const paymentSchema = z.object({
  party_id: z.string().min(1, 'Party is required'),
  type: z.enum(['payment', 'receipt']),
  receipt_number: z.string().min(1, 'Number is required'),
  receipt_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  payment_mode: z.enum(['cash', 'bank', 'cheque', 'upi', 'other']),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VouchersEntry() {
  usePageTitle('Vouchers Entry');
  const queryClient = useQueryClient();
  const fyId = useSelectedFYId();
  const { selectedDate } = useDateStore();
  const [activeTab, setActiveTab] = useState<VoucherTab>('journal');

  // Whether the active tab is a "payment/receipt" type (uses PaymentReceipt CRUD)
  const isPaymentTab = activeTab === 'payment' || activeTab === 'receipt';

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts if user is typing in an input/textarea or modal is open
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const match = VOUCHER_TYPES.find((v) => v.shortcutKey === e.key);
    if (match) {
      e.preventDefault();
      setActiveTab(match.key);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ─── Shared State ───────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Reset page/search when switching tabs
  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [activeTab]);

  // ─── Journal Entries State ──────────────────────────────────────────────

  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showJournalDetail, setShowJournalDetail] = useState<Voucher | null>(null);

  const { data: journalData, isLoading: journalLoading } = useQuery({
    queryKey: ['vouchers', page, search, activeTab],
    queryFn: () => vouchersApi.list({ page: String(page), search, voucher_type: activeTab }),
    select: (res) => res.data,
    enabled: !isPaymentTab,
  });

  const { data: ledgersData } = useQuery({
    queryKey: ['ledgers-all'],
    queryFn: () => ledgersApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const journalCreateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vouchersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      closeJournalModal();
      toast.success('Voucher created');
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const journalForm = useForm<JournalForm>({
    resolver: zodResolver(journalSchema) as any,
    defaultValues: {
      voucher_type: 'journal',
      lines: [
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
      ],
    },
  });

  const { fields: journalFields, append: appendLine, remove: removeLine } = useFieldArray({ control: journalForm.control, name: 'lines' });
  const watchedLines = journalForm.watch('lines');

  const totalDebit = (watchedLines ?? []).reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = (watchedLines ?? []).reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const openJournalCreate = () => {
    journalForm.reset({
      voucher_date: selectedDate,
      voucher_type: activeTab,
      narration: '',
      lines: [
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
      ],
    });
    setShowJournalModal(true);
  };

  const closeJournalModal = () => {
    setShowJournalModal(false);
    journalForm.reset();
  };

  const onJournalSubmit = (formData: JournalForm) => {
    journalCreateMutation.mutate({
      ...formData,
      voucher_type: activeTab,
      financial_year_id: fyId,
    } as unknown as Record<string, unknown>);
  };

  const ledgerSlideOptions = (ledgersData?.data ?? []).map((l) => ({ value: l.id, label: l.name, subtitle: l.group?.name }));

  // ─── Payment/Receipt State ──────────────────────────────────────────────

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentReceipt | null>(null);
  const [showPaymentDetail, setShowPaymentDetail] = useState<PaymentReceipt | null>(null);

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ['payment-receipts', page, search, activeTab],
    queryFn: () => paymentReceiptsApi.list({ page: String(page), search, type: activeTab }),
    select: (res) => res.data,
    enabled: isPaymentTab,
  });

  const { data: partiesData } = useQuery({
    queryKey: ['parties-all'],
    queryFn: () => partiesApi.list({ per_page: '500' }),
    select: (res) => res.data,
    enabled: isPaymentTab,
  });

  const paymentCreateMutation = useMutation({
    mutationFn: (data: PaymentForm) => paymentReceiptsApi.create(data as unknown as Partial<PaymentReceipt>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
      closePaymentModal();
      toast.success(activeTab === 'payment' ? 'Payment created' : 'Receipt created');
    },
  });

  const paymentDeleteMutation = useMutation({
    mutationFn: (id: string) => paymentReceiptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
      toast.success('Record deleted');
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentForm = useForm<PaymentForm>({ resolver: zodResolver(paymentSchema) as any });

  const openPaymentCreate = () => {
    setEditPayment(null);
    paymentForm.reset({
      type: activeTab as 'payment' | 'receipt',
      payment_mode: 'cash',
      receipt_date: selectedDate,
      amount: undefined as unknown as number,
      receipt_number: '',
      party_id: '',
      reference_number: '',
      bank_name: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const openPaymentEdit = (record: PaymentReceipt) => {
    setEditPayment(record);
    paymentForm.reset({
      party_id: record.party_id,
      type: record.type,
      receipt_number: record.receipt_number,
      receipt_date: record.receipt_date,
      amount: record.amount,
      payment_mode: record.payment_mode,
      reference_number: record.reference_number ?? '',
      bank_name: record.bank_name ?? '',
      notes: record.notes ?? '',
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setEditPayment(null);
    paymentForm.reset();
  };

  const onPaymentSubmit = (formData: PaymentForm) => {
    paymentCreateMutation.mutate({ ...formData, type: activeTab as 'payment' | 'receipt' });
  };

  const partySlideOptions = (partiesData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type }));

  // ─── Column Definitions ─────────────────────────────────────────────────

  const journalColumns: ColumnDef<Voucher, unknown>[] = [
    { accessorKey: 'voucher_number', header: 'Voucher #' },
    { accessorKey: 'voucher_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'voucher_type', header: 'Type', cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => <span className="truncate max-w-[200px] block">{(getValue() as string) ?? '—'}</span> },
    { accessorKey: 'is_posted', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'warning'}>{getValue() ? 'Posted' : 'Draft'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button onClick={() => setShowJournalDetail(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      ),
    },
  ];

  const paymentColumns: ColumnDef<PaymentReceipt, unknown>[] = [
    { accessorKey: 'receipt_number', header: 'Number' },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <Badge variant={getValue() === 'receipt' ? 'success' : 'info'}>{getValue() as string}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'receipt_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'payment_mode', header: 'Mode', cell: ({ getValue }) => <Badge>{(getValue() as string).toUpperCase()}</Badge> },
    { accessorKey: 'reference_number', header: 'Reference' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPaymentDetail(row.original)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="View journal entry"
          >
            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button onClick={() => openPaymentEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this record?')) paymentDeleteMutation.mutate(row.original.id); }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  // ─── Active config ──────────────────────────────────────────────────────

  const activeConfig = VOUCHER_TYPES.find((v) => v.key === activeTab)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vouchers Entry</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select a voucher type to create or view entries. Use keyboard shortcuts for quick access.
        </p>
      </div>

      {/* Voucher Type Buttons */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {VOUCHER_TYPES.map((vt) => {
          const Icon = vt.icon;
          const isActive = activeTab === vt.key;
          return (
            <div key={vt.key} className="group relative">
              <button
                onClick={() => setActiveTab(vt.key)}
                className={`w-full flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all duration-200 ${
                  isActive ? vt.activeColor : vt.color
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{vt.label}</span>
                <kbd className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                  isActive
                    ? 'bg-white/50 dark:bg-black/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {vt.shortcut}
                </kbd>
              </button>
              {/* Tooltip */}
              <div className="pointer-events-none absolute -bottom-1 left-1/2 z-50 -translate-x-1/2 translate-y-full opacity-0 transition-opacity group-hover:opacity-100">
                <div className="mt-2 w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{vt.label}</span>
                  <span className="ml-1 text-gray-400">({vt.shortcut})</span>
                  <p className="mt-1">{vt.purpose}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Area */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder={`Search ${activeConfig.label.toLowerCase()} vouchers...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Button onClick={isPaymentTab ? openPaymentCreate : openJournalCreate}>
              <Plus className="mr-2 h-4 w-4" /> New {activeConfig.label}
            </Button>
          </div>
        </CardHeader>

        {isPaymentTab ? (
          <>
            <DataTable columns={paymentColumns} data={paymentData?.data ?? []} loading={paymentLoading} />
            {paymentData && <Pagination currentPage={paymentData.current_page} lastPage={paymentData.last_page} total={paymentData.total} onPageChange={setPage} />}
          </>
        ) : (
          <>
            <DataTable columns={journalColumns} data={journalData?.data ?? []} loading={journalLoading} />
            {journalData && <Pagination currentPage={journalData.current_page} lastPage={journalData.last_page} total={journalData.total} onPageChange={setPage} />}
          </>
        )}
      </Card>

      {/* ─── Journal Create Modal ────────────────────────────────────────── */}
      <Modal open={showJournalModal} onClose={closeJournalModal} title={`New ${activeConfig.label} Voucher`} size="xl">
        <form onSubmit={journalForm.handleSubmit(onJournalSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="voucher_date" label="Voucher Date" type="date" error={journalForm.formState.errors.voucher_date?.message} {...journalForm.register('voucher_date')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voucher Type</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                <activeConfig.icon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeConfig.label}</span>
                <kbd className="ml-auto text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">{activeConfig.shortcut}</kbd>
              </div>
            </div>
          </div>
          <Input id="narration" label="Narration" {...journalForm.register('narration')} />

          {/* Journal Lines */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entries (Debit = Credit)</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => appendLine({ ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' })}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            {typeof journalForm.formState.errors.lines?.message === 'string' && <p className="text-sm text-red-500 mb-2">{journalForm.formState.errors.lines.message}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                <div className="col-span-5">Ledger</div>
                <div className="col-span-2">Debit ({'\u20B9'})</div>
                <div className="col-span-2">Credit ({'\u20B9'})</div>
                <div className="col-span-2">Narration</div>
                <div className="col-span-1"></div>
              </div>
              {journalFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <SlideSelect
                      name={`lines.${index}.ledger_id`}
                      placeholder="Select ledger"
                      panelTitle="Select Ledger"
                      options={ledgerSlideOptions}
                      value={journalForm.watch(`lines.${index}.ledger_id`)}
                      onChange={(val) => journalForm.setValue(`lines.${index}.ledger_id`, val, { shouldValidate: true })}
                      error={journalForm.formState.errors.lines?.[index]?.ledger_id?.message}
                    />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...journalForm.register(`lines.${index}.debit`)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...journalForm.register(`lines.${index}.credit`)} />
                  </div>
                  <div className="col-span-2">
                    <input className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" placeholder="Note" {...journalForm.register(`lines.${index}.narration`)} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {journalFields.length > 2 && (
                      <button type="button" onClick={() => removeLine(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="mt-4 border-t dark:border-gray-700 pt-3 grid grid-cols-12 gap-2 text-sm font-semibold">
              <div className="col-span-5 text-right text-gray-500 dark:text-gray-400">Totals:</div>
              <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalDebit)}</div>
              <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalCredit)}</div>
              <div className="col-span-3">
                {isBalanced ? (
                  <Badge variant="success">Balanced</Badge>
                ) : (
                  <Badge variant="danger">Diff: {formatCurrency(Math.abs(totalDebit - totalCredit))}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeJournalModal}>Cancel</Button>
            <Button type="submit" loading={journalCreateMutation.isPending} disabled={!isBalanced}>Create {activeConfig.label}</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Journal Detail Modal ────────────────────────────────────────── */}
      <Modal open={!!showJournalDetail} onClose={() => setShowJournalDetail(null)} title={`Voucher: ${showJournalDetail?.voucher_number ?? ''}`} size="lg">
        {showJournalDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Date: </span><span className="font-medium">{formatDate(showJournalDetail.voucher_date)}</span></div>
              <div><span className="text-gray-500">Type: </span><Badge>{showJournalDetail.voucher_type}</Badge></div>
              <div><span className="text-gray-500">Status: </span><Badge variant={showJournalDetail.is_posted ? 'success' : 'warning'}>{showJournalDetail.is_posted ? 'Posted' : 'Draft'}</Badge></div>
              {showJournalDetail.narration && <div className="col-span-2"><span className="text-gray-500">Narration: </span><span>{showJournalDetail.narration}</span></div>}
            </div>
            {showJournalDetail.lines && showJournalDetail.lines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2">Ledger</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {showJournalDetail.lines.map((line) => (
                    <tr key={line.id} className="border-b dark:border-gray-700">
                      <td className="py-2">{line.ledger?.name ?? line.ledger_id}</td>
                      <td className="py-2 text-right">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td className="py-2 text-right">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{formatCurrency(showJournalDetail.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0))}</td>
                    <td className="py-2 text-right">{formatCurrency(showJournalDetail.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowJournalDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Payment/Receipt Detail Modal ────────────────────────────────── */}
      <PaymentVoucherDetailModal
        record={showPaymentDetail}
        onClose={() => setShowPaymentDetail(null)}
      />

      {/* ─── Payment/Receipt Create/Edit Modal ───────────────────────────── */}
      <Modal open={showPaymentModal} onClose={closePaymentModal} title={editPayment ? `Edit ${activeConfig.label}` : `New ${activeConfig.label}`} size="lg">
        <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voucher Type</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                <activeConfig.icon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeConfig.label}</span>
                <kbd className="ml-auto text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">{activeConfig.shortcut}</kbd>
              </div>
            </div>
            <Input id="receipt_number" label="Number" error={paymentForm.formState.errors.receipt_number?.message} {...paymentForm.register('receipt_number')} />
            <SlideSelect
              name="party_id"
              label="Party"
              placeholder="Select party"
              panelTitle="Select Party"
              options={partySlideOptions}
              value={paymentForm.watch('party_id')}
              onChange={(val) => paymentForm.setValue('party_id', val, { shouldValidate: true })}
              error={paymentForm.formState.errors.party_id?.message}
            />
            <Input id="receipt_date" label="Date" type="date" error={paymentForm.formState.errors.receipt_date?.message} {...paymentForm.register('receipt_date')} />
            <Input id="amount" label={`Amount (${'\u20B9'})`} type="number" step="0.01" error={paymentForm.formState.errors.amount?.message} {...paymentForm.register('amount')} />
            <SlideSelect
              name="payment_mode"
              label="Payment Mode"
              placeholder="Select mode"
              panelTitle="Payment Mode"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'upi', label: 'UPI' },
                { value: 'other', label: 'Other' },
              ]}
              value={paymentForm.watch('payment_mode')}
              onChange={(val) => paymentForm.setValue('payment_mode', val as 'cash' | 'bank' | 'cheque' | 'upi' | 'other', { shouldValidate: true })}
              error={paymentForm.formState.errors.payment_mode?.message}
            />
            <Input id="reference_number" label="Reference Number" {...paymentForm.register('reference_number')} />
            <Input id="bank_name" label="Bank Name" {...paymentForm.register('bank_name')} />
          </div>
          <Input id="notes" label="Notes" {...paymentForm.register('notes')} />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closePaymentModal}>Cancel</Button>
            <Button type="submit" loading={paymentCreateMutation.isPending}>
              {editPayment ? 'Update' : `Create ${activeConfig.label}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
