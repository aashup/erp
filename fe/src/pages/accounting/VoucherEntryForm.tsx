import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { vouchersApi, ledgersApi, paymentReceiptsApi } from '@/api/accounting';
import { partiesApi } from '@/api/parties';
import type { PaymentReceipt } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useSelectedFYId } from '@/hooks/useFinancialYear';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  X,
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  BookOpen,
  ShoppingCart,
  Receipt,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type VoucherTab = 'contra' | 'payment' | 'receipt' | 'journal' | 'sales' | 'purchase';

const TYPE_CONFIG: Record<VoucherTab, { label: string; shortcut: string; icon: typeof ArrowLeftRight; iconBg: string; iconColor: string; color: string }> = {
  contra: { label: 'Contra', shortcut: 'F4', icon: ArrowLeftRight, iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400', color: 'text-purple-700 dark:text-purple-300' },
  payment: { label: 'Payment', shortcut: 'F5', icon: CreditCard, iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400', color: 'text-red-700 dark:text-red-300' },
  receipt: { label: 'Receipt', shortcut: 'F6', icon: HandCoins, iconBg: 'bg-green-100 dark:bg-green-900/40', iconColor: 'text-green-600 dark:text-green-400', color: 'text-green-700 dark:text-green-300' },
  journal: { label: 'Journal', shortcut: 'F7', icon: BookOpen, iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', color: 'text-blue-700 dark:text-blue-300' },
  sales: { label: 'Sales', shortcut: 'F8', icon: Receipt, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', color: 'text-emerald-700 dark:text-emerald-300' },
  purchase: { label: 'Purchase', shortcut: 'F9', icon: ShoppingCart, iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconColor: 'text-orange-600 dark:text-orange-400', color: 'text-orange-700 dark:text-orange-300' },
};

const PAYMENT_TYPES = new Set<VoucherTab>(['payment', 'receipt']);

// ─── Journal Schema ───────────────────────────────────────────────────────────

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
    const totalDebit = data.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits', path: ['lines'] }
);

type JournalForm = z.infer<typeof journalSchema>;

// ─── Payment Schema ───────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoucherEntryForm() {
  const { type } = useParams<{ type: VoucherTab }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fyId = useSelectedFYId();

  const voucherType = (type ?? 'journal') as VoucherTab;
  const config = TYPE_CONFIG[voucherType] ?? TYPE_CONFIG.journal;
  const isPaymentType = PAYMENT_TYPES.has(voucherType);

  // For edit mode (payment/receipt passed via navigation state)
  const editRecord = (location.state as { edit?: PaymentReceipt } | null)?.edit ?? null;
  const isEdit = !!editRecord;

  usePageTitle(`${isEdit ? 'Edit' : 'New'} ${config.label} Voucher`);

  const Icon = config.icon;

  // ─── Ledger options ────────────────────────────────────────────────────────

  const { data: ledgersData } = useQuery({
    queryKey: ['ledgers-all'],
    queryFn: () => ledgersApi.list({ per_page: '500' }),
    select: (res) => res.data,
    enabled: !isPaymentType,
  });

  const ledgerSlideOptions = (ledgersData?.data ?? []).map((l) => ({ value: l.id, label: l.name, subtitle: l.group?.name }));

  // ─── Party options ─────────────────────────────────────────────────────────

  const { data: partiesData } = useQuery({
    queryKey: ['parties-all'],
    queryFn: () => partiesApi.list({ per_page: '500' }),
    select: (res) => res.data,
    enabled: isPaymentType,
  });

  const partySlideOptions = (partiesData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type }));

  // ─── Journal form ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const journalForm = useForm<JournalForm>({
    resolver: zodResolver(journalSchema) as any,
    defaultValues: {
      voucher_date: new Date().toISOString().split('T')[0],
      voucher_type: voucherType,
      narration: '',
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

  const journalMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vouchersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success('Voucher created');
      navigate(`/accounting/vouchers/${voucherType}`);
    },
  });

  const onJournalSubmit = (formData: JournalForm) => {
    journalMutation.mutate({
      ...formData,
      voucher_type: voucherType,
      financial_year_id: fyId,
    } as unknown as Record<string, unknown>);
  };

  // ─── Payment form ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: editRecord
      ? {
          party_id: editRecord.party_id,
          type: editRecord.type,
          receipt_number: editRecord.receipt_number,
          receipt_date: editRecord.receipt_date,
          amount: editRecord.amount,
          payment_mode: editRecord.payment_mode,
          reference_number: editRecord.reference_number ?? '',
          bank_name: editRecord.bank_name ?? '',
          notes: editRecord.notes ?? '',
        }
      : {
          type: voucherType as 'payment' | 'receipt',
          payment_mode: 'cash',
          receipt_date: new Date().toISOString().split('T')[0],
          amount: undefined as unknown as number,
          receipt_number: '',
          party_id: '',
          reference_number: '',
          bank_name: '',
          notes: '',
        },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: PaymentForm) => paymentReceiptsApi.create(data as unknown as Partial<PaymentReceipt>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
      toast.success(voucherType === 'payment' ? 'Payment created' : 'Receipt created');
      navigate(`/accounting/vouchers/${voucherType}`);
    },
  });

  const onPaymentSubmit = (formData: PaymentForm) => {
    paymentMutation.mutate({ ...formData, type: voucherType as 'payment' | 'receipt' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/accounting/vouchers/${voucherType}`)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${config.color}`}>{isEdit ? 'Edit' : 'New'} {config.label} Voucher</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Shortcut: <kbd className="px-1 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 rounded">{config.shortcut}</kbd></p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entry Details</h2>
        </CardHeader>
        <CardContent>
          {isPaymentType ? (
            /* ─── Payment / Receipt Form ─────────────────────────────────────── */
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Voucher type badge */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voucher Type</label>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    <kbd className="ml-2 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">{config.shortcut}</kbd>
                  </div>
                </div>

                <Input id="receipt_number" label="Number" error={paymentForm.formState.errors.receipt_number?.message} {...paymentForm.register('receipt_number')} />
                <Input id="receipt_date" label="Date" type="date" error={paymentForm.formState.errors.receipt_date?.message} {...paymentForm.register('receipt_date')} />

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

                <Input id="amount" label={`Amount (\u20B9)`} type="number" step="0.01" error={paymentForm.formState.errors.amount?.message} {...paymentForm.register('amount')} />

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

                <div className="sm:col-span-2">
                  <Input id="notes" label="Notes" {...paymentForm.register('notes')} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={() => navigate(`/accounting/vouchers/${voucherType}`)}>Cancel</Button>
                <Button type="submit" loading={paymentMutation.isPending}>
                  {isEdit ? 'Update' : `Create ${config.label}`}
                </Button>
              </div>
            </form>
          ) : (
            /* ─── Journal / Contra / Sales / Purchase Form ───────────────────── */
            <form onSubmit={journalForm.handleSubmit(onJournalSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input id="voucher_date" label="Voucher Date" type="date" error={journalForm.formState.errors.voucher_date?.message} {...journalForm.register('voucher_date')} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voucher Type</label>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    <kbd className="ml-auto text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">{config.shortcut}</kbd>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Input id="narration" label="Narration" {...journalForm.register('narration')} />
                </div>
              </div>

              {/* Journal Lines */}
              <div className="border-t dark:border-gray-700 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ledger Entries <span className="text-gray-400 font-normal">(Debit = Credit)</span></h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => appendLine({ ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' })}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Line
                  </Button>
                </div>

                {typeof journalForm.formState.errors.lines?.message === 'string' && (
                  <p className="text-sm text-red-500 mb-3">{journalForm.formState.errors.lines.message}</p>
                )}

                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1 mb-2">
                  <div className="col-span-5">Ledger</div>
                  <div className="col-span-2">Debit (\u20B9)</div>
                  <div className="col-span-2">Credit (\u20B9)</div>
                  <div className="col-span-2">Narration</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-3">
                  {journalFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 sm:col-span-5">
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
                      <div className="col-span-5 sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Debit"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                          {...journalForm.register(`lines.${index}.debit`)}
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Credit"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                          {...journalForm.register(`lines.${index}.credit`)}
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-2">
                        <input
                          placeholder="Note"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                          {...journalForm.register(`lines.${index}.narration`)}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                        {journalFields.length > 2 && (
                          <button type="button" onClick={() => removeLine(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals row */}
                <div className="mt-5 border-t dark:border-gray-700 pt-4 grid grid-cols-12 gap-2 text-sm font-semibold">
                  <div className="col-span-5 text-right text-gray-500 dark:text-gray-400 flex items-center justify-end">Totals:</div>
                  <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalDebit)}</div>
                  <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalCredit)}</div>
                  <div className="col-span-3 flex items-center">
                    {isBalanced ? (
                      <Badge variant="success">Balanced</Badge>
                    ) : (
                      <Badge variant="danger">Diff: {formatCurrency(Math.abs(totalDebit - totalCredit))}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={() => navigate(`/accounting/vouchers/${voucherType}`)}>Cancel</Button>
                <Button type="submit" loading={journalMutation.isPending} disabled={!isBalanced}>
                  Create {config.label}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
