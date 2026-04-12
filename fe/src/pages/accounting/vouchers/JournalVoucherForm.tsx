import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { vouchersApi, ledgersApi } from '@/api/accounting';
import { formatCurrency } from '@/lib/utils';
import { useSelectedFYId } from '@/hooks/useFinancialYear';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { LedgerBalanceBadge } from '@/components/accounting/LedgerBalanceBadge';

import { TYPE_CONFIG, type VoucherTab } from './types';
import { journalSchema, type JournalForm } from './schemas';
import { VoucherFormHeader } from './VoucherFormHeader';
import { useDateStore } from '@/store/dateStore';

interface JournalVoucherFormProps {
  voucherType: VoucherTab;
}

export function JournalVoucherForm({ voucherType }: JournalVoucherFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fyId = useSelectedFYId();
  const config = TYPE_CONFIG[voucherType];
  const { selectedDate } = useDateStore();

  usePageTitle(`New ${config.label} Voucher`);

  const { data: ledgersData } = useQuery({
    queryKey: ['ledgers-all'],
    queryFn: () => ledgersApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const ledgerOptions = (ledgersData?.data ?? []).map((l) => ({
    value: l.id,
    label: l.name,
    subtitle: l.group?.name,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<JournalForm>({
    resolver: zodResolver(journalSchema) as any,
    defaultValues: {
      voucher_date: selectedDate,
      voucher_type: voucherType,
      narration: '',
      lines: [
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const watchedLines = form.watch('lines');
  const totalDebit  = watchedLines.reduce((sum, l) => sum + (Number(l.debit)  || 0), 0);
  const totalCredit = watchedLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vouchersApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      const voucherNumber = response.data.data.voucher_number;
      toast.success(`${config.label} ${voucherNumber} created successfully`);
      navigate(`/accounting/vouchers/${voucherType}`);
    },
  });

  const onSubmit = (formData: JournalForm) => {
    mutation.mutate({
      ...formData,
      voucher_type: voucherType,
      financial_year_id: fyId,
    } as unknown as Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <VoucherFormHeader
        voucherType={voucherType}
        onBack={() => navigate(`/accounting/vouchers/${voucherType}`)}
      />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entry Details</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                id="voucher_date"
                label="Voucher Date"
                type="date"
                error={form.formState.errors.voucher_date?.message}
                {...form.register('voucher_date')}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Voucher Type
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                  <config.icon className={`h-4 w-4 ${config.iconColor}`} />
                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  <kbd className="ml-auto text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">
                    {config.shortcut}
                  </kbd>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Input id="narration" label="Narration" {...form.register('narration')} />
              </div>
            </div>

            {/* Ledger Lines */}
            <div className="border-t dark:border-gray-700 pt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ledger Entries <span className="text-gray-400 font-normal">(Debit = Credit)</span>
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    append({
                      ledger_id: '',
                      debit:  '' as unknown as number,
                      credit: '' as unknown as number,
                      narration: '',
                    })
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
                <div className="col-span-5">Ledger</div>
                <div className="col-span-2">Debit (₹)</div>
                <div className="col-span-2">Credit (₹)</div>
                <div className="col-span-2">Narration</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-5">
                      <SlideSelect
                        name={`lines.${index}.ledger_id`}
                        placeholder="Select ledger"
                        panelTitle="Select Ledger"
                        options={ledgerOptions}
                        value={form.watch(`lines.${index}.ledger_id`)}
                        onChange={(val) =>
                          form.setValue(`lines.${index}.ledger_id`, val, { shouldValidate: true })
                        }
                        error={form.formState.errors.lines?.[index]?.ledger_id?.message}
                      />
                      <LedgerBalanceBadge ledgerId={form.watch(`lines.${index}.ledger_id`)} />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                        {...form.register(`lines.${index}.debit`)}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                        {...form.register(`lines.${index}.credit`)}
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-2">
                      <input
                        placeholder="Note"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                        {...form.register(`lines.${index}.narration`)}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                      {fields.length > 2 && (
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
                ))}
              </div>

              {/* Totals row */}
              <div className="mt-5 border-t dark:border-gray-700 pt-4 grid grid-cols-12 gap-2 text-sm font-semibold">
                <div className="col-span-5 text-right text-gray-500 dark:text-gray-400 flex items-center justify-end">
                  Totals:
                </div>
                <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalDebit)}
                </div>
                <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalCredit)}
                </div>
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/accounting/vouchers/${voucherType}`)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={!isBalanced}>
                Create {config.label}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
