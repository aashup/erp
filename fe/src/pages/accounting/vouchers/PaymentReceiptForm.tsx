import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

import { paymentReceiptsApi } from '@/api/accounting';
import { partiesApi } from '@/api/parties';
import type { PaymentReceipt } from '@/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useFYBounds } from '@/hooks/useFinancialYear';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';

import { TYPE_CONFIG, type VoucherTab } from './types';
import { paymentSchema, type PaymentForm } from './schemas';
import { VoucherFormHeader } from './VoucherFormHeader';
import { dateToUtcIso } from '@/lib/utils';
import { useDateStore } from '@/store/dateStore';

interface PaymentReceiptFormProps {
  voucherType: VoucherTab;
}

export function PaymentReceiptForm({ voucherType }: PaymentReceiptFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const config = TYPE_CONFIG[voucherType];
  const fyBounds = useFYBounds();
  const { selectedDate } = useDateStore();

  const validatedSchema = useMemo(() => {
    if (!fyBounds) return paymentSchema;
    return paymentSchema.superRefine((data, ctx) => {
      if (data.receipt_date && (data.receipt_date < fyBounds.start || data.receipt_date > fyBounds.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Date must be within FY ${fyBounds.label}`, path: ['receipt_date'] });
      }
    });
  }, [fyBounds?.start, fyBounds?.end, fyBounds?.label]);

  const editRecord = (location.state as { edit?: PaymentReceipt } | null)?.edit ?? null;
  const isEdit = !!editRecord;

  usePageTitle(`${isEdit ? 'Edit' : 'New'} ${config.label} Voucher`);

  const { data: partiesData } = useQuery({
    queryKey: ['parties-all'],
    queryFn: () => partiesApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const partyOptions = (partiesData?.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    subtitle: p.type,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<PaymentForm>({
    resolver: zodResolver(validatedSchema) as any,
    defaultValues: editRecord
      ? {
          party_id:         editRecord.party_id,
          type:             editRecord.type,
          receipt_number:   editRecord.receipt_number,
          receipt_date:     (editRecord.receipt_date as string).split('T')[0],
          amount:           editRecord.amount,
          payment_mode:     editRecord.payment_mode,
          reference_number: editRecord.reference_number ?? '',
          bank_name:        editRecord.bank_name ?? '',
          notes:            editRecord.notes ?? '',
        }
      : {
          type:             voucherType as 'payment' | 'receipt',
          payment_mode:     'cash',
          receipt_date:     selectedDate,
          amount:           undefined as unknown as number,
          receipt_number:   '',
          party_id:         '',
          reference_number: '',
          bank_name:        '',
          notes:            '',
        },
  });

  const mutation = useMutation({
    mutationFn: (data: PaymentForm) =>
      paymentReceiptsApi.create(data as unknown as Partial<PaymentReceipt>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
      toast.success(voucherType === 'payment' ? 'Payment created' : 'Receipt created');
      navigate(`/accounting/vouchers/${voucherType}`);
    },
  });

  const onSubmit = (formData: PaymentForm) => {
    mutation.mutate({ ...formData, type: voucherType as 'payment' | 'receipt', receipt_date: dateToUtcIso(formData.receipt_date) });
  };

  return (
    <div className="space-y-6">
      <VoucherFormHeader
        voucherType={voucherType}
        isEdit={isEdit}
        onBack={() => navigate(`/accounting/vouchers/${voucherType}`)}
      />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entry Details</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Voucher type badge */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Voucher Type
                </label>
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 py-2 px-3">
                  <config.icon className={`h-4 w-4 ${config.iconColor}`} />
                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  <kbd className="ml-2 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">
                    {config.shortcut}
                  </kbd>
                </div>
              </div>

              <Input
                id="receipt_number"
                label="Number"
                error={form.formState.errors.receipt_number?.message}
                {...form.register('receipt_number')}
              />
              <Input
                id="receipt_date"
                label="Date"
                type="date"
                error={form.formState.errors.receipt_date?.message}
                {...form.register('receipt_date')}
              />

              <SlideSelect
                name="party_id"
                label="Party"
                placeholder="Select party"
                panelTitle="Select Party"
                options={partyOptions}
                value={form.watch('party_id')}
                onChange={(val) => form.setValue('party_id', val, { shouldValidate: true })}
                error={form.formState.errors.party_id?.message}
              />

              <Input
                id="amount"
                label="Amount (₹)"
                type="number"
                step="0.01"
                error={form.formState.errors.amount?.message}
                {...form.register('amount')}
              />

              <SlideSelect
                name="payment_mode"
                label="Payment Mode"
                placeholder="Select mode"
                panelTitle="Payment Mode"
                options={[
                  { value: 'cash',   label: 'Cash' },
                  { value: 'bank',   label: 'Bank Transfer' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'upi',    label: 'UPI' },
                  { value: 'other',  label: 'Other' },
                ]}
                value={form.watch('payment_mode')}
                onChange={(val) =>
                  form.setValue('payment_mode', val as 'cash' | 'bank' | 'cheque' | 'upi' | 'other', {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.payment_mode?.message}
              />

              <Input
                id="reference_number"
                label="Reference Number"
                {...form.register('reference_number')}
              />
              <Input id="bank_name" label="Bank Name" {...form.register('bank_name')} />

              <div className="sm:col-span-2">
                <Input id="notes" label="Notes" {...form.register('notes')} />
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
              <Button type="submit" loading={mutation.isPending}>
                {isEdit ? 'Update' : `Create ${config.label}`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
