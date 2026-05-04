import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { vouchersApi, ledgersApi } from '@/api/accounting';
import { formatCurrency, dateToUtcIso } from '@/lib/utils';
import { useSelectedFYId, useFYBounds } from '@/hooks/useFinancialYear';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { LedgerBalanceBadge } from '@/components/accounting/LedgerBalanceBadge';

import { paymentVoucherSchema, type PaymentVoucherForm as ReceiptVoucherFormType } from './schemas';
import { VoucherFormHeader } from './VoucherFormHeader';
import { useDateStore } from '@/store/dateStore';

export function ReceiptVoucherForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fyId = useSelectedFYId();
  const fyBounds = useFYBounds();
  const { selectedDate } = useDateStore();

  const validatedSchema = useMemo(() => {
    if (!fyBounds) return paymentVoucherSchema;
    return paymentVoucherSchema.superRefine((data, ctx) => {
      if (data.voucher_date && (data.voucher_date < fyBounds.start || data.voucher_date > fyBounds.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Date must be within FY ${fyBounds.label}`, path: ['voucher_date'] });
      }
    });
  }, [fyBounds?.start, fyBounds?.end, fyBounds?.label]);

  usePageTitle('New Receipt Voucher');

  const { data: ledgersData } = useQuery({
    queryKey: ['ledgers-all'],
    queryFn: () => ledgersApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const allLedgers = ledgersData?.data ?? [];

  // Received Into: only bank (1210) and cash (1220) accounts
  const intoLedgerOptions = allLedgers
    .filter((l) => l.group?.code === '1210' || l.group?.code === '1220')
    .map((l) => ({ value: l.id, label: l.name, subtitle: l.group?.name }));

  // Received From lines: exclude bank and cash ledgers
  const receiveFromOptions = allLedgers
    .filter((l) => l.group?.code !== '1210' && l.group?.code !== '1220')
    .map((l) => ({ value: l.id, label: l.name, subtitle: l.group?.name }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<ReceiptVoucherFormType>({
    resolver: zodResolver(validatedSchema) as any,
    defaultValues: {
      voucher_date:   selectedDate,
      narration:      '',
      from_ledger_id: '',
      lines: [
        { ledger_id: '', amount: '' as unknown as number, narration: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const watchedLines = form.watch('lines');
  const totalAmount = watchedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const isValid = totalAmount > 0;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vouchersApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      const voucherNumber = response.data.data.voucher_number;
      toast.success(`Receipt Voucher ${voucherNumber} created successfully`);
      navigate('/accounting/vouchers/receipt');
    },
  });

  const onSubmit = (formData: ReceiptVoucherFormType) => {
    const total = formData.lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    mutation.mutate({
      voucher_type:      'receipt',
      voucher_date:      dateToUtcIso(formData.voucher_date),
      financial_year_id: fyId,
      narration:         formData.narration,
      lines: [
        // Receipt Into: Debit (money received goes into bank/cash)
        { ledger_id: formData.from_ledger_id, debit: total, credit: 0 },
        // Received From: Credit each party
        ...formData.lines.map((l) => ({
          ledger_id: l.ledger_id,
          debit:     0,
          credit:    Number(l.amount || 0),
          narration: l.narration,
        })),
      ],
    } as unknown as Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <VoucherFormHeader
        voucherType="receipt"
        onBack={() => navigate('/accounting/vouchers/receipt')}
      />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entry Details</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Received Into + Date row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Received Into
                </label>
                <SlideSelect
                  name="from_ledger_id"
                  placeholder="Select bank or cash account"
                  panelTitle="Select Account"
                  options={intoLedgerOptions}
                  value={form.watch('from_ledger_id')}
                  onChange={(val) =>
                    form.setValue('from_ledger_id', val, { shouldValidate: true })
                  }
                  error={form.formState.errors.from_ledger_id?.message}
                />
                <LedgerBalanceBadge ledgerId={form.watch('from_ledger_id')} />
              </div>
              <Input
                id="voucher_date"
                label="Voucher Date"
                type="date"
                error={form.formState.errors.voucher_date?.message}
                {...form.register('voucher_date')}
              />
            </div>

            {/* Receipt Lines */}
            <div className="border-t dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Received From
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    append({ ledger_id: '', amount: '' as unknown as number, narration: '' })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Line
                </Button>
              </div>

              {typeof form.formState.errors.lines?.message === 'string' && (
                <p className="text-sm text-red-500 mb-3">{form.formState.errors.lines.message}</p>
              )}

              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1 mb-2">
                <div className="col-span-6">Party / Ledger</div>
                <div className="col-span-3">Amount (₹)</div>
                <div className="col-span-2">Note</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const selectedElsewhere = new Set(
                    watchedLines
                      .filter((_, i) => i !== index)
                      .map((l) => l.ledger_id)
                      .filter(Boolean)
                  );
                  const lineOptions = receiveFromOptions.filter(
                    (o) => !selectedElsewhere.has(o.value)
                  );

                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                      {/* Ledger */}
                      <div className="col-span-12 sm:col-span-6">
                        <SlideSelect
                          name={`lines.${index}.ledger_id`}
                          placeholder="Select party or ledger"
                          panelTitle="Select Ledger"
                          options={lineOptions}
                          value={form.watch(`lines.${index}.ledger_id`)}
                          onChange={(val) =>
                            form.setValue(`lines.${index}.ledger_id`, val, { shouldValidate: true })
                          }
                          error={form.formState.errors.lines?.[index]?.ledger_id?.message}
                        />
                        <LedgerBalanceBadge ledgerId={form.watch(`lines.${index}.ledger_id`)} />
                      </div>
                      {/* Amount */}
                      <div className="col-span-5 sm:col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                          {...form.register(`lines.${index}.amount`)}
                        />
                        {form.formState.errors.lines?.[index]?.amount && (
                          <p className="text-xs text-red-500 mt-1">
                            {form.formState.errors.lines[index].amount?.message}
                          </p>
                        )}
                      </div>
                      {/* Note */}
                      <div className="col-span-6 sm:col-span-2">
                        <input
                          placeholder="Note"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                          {...form.register(`lines.${index}.narration`)}
                        />
                      </div>
                      {/* Remove */}
                      <div className="col-span-1 flex items-center justify-center">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Narration */}
              <div className="mt-4">
                <Input id="narration" label="Narration" {...form.register('narration')} />
              </div>

              {/* Totals row */}
              <div className="mt-5 border-t dark:border-gray-700 pt-4 flex items-center justify-between text-sm font-semibold">
                <span className="text-gray-500 dark:text-gray-400">Total Receipt:</span>
                <div className="flex items-center gap-3">
                  <span className={isValid ? 'text-green-600' : 'text-gray-400'}>
                    {formatCurrency(totalAmount)}
                  </span>
                  {isValid ? (
                    <Badge variant="success">Balanced</Badge>
                  ) : (
                    <Badge variant="danger">Enter amounts</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/accounting/vouchers/receipt')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={!isValid}>
                Create Receipt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
