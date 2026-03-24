import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { paymentReceiptsApi } from '@/api/accounting';
import type { PaymentReceipt } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search } from 'lucide-react';

const schema = z.object({
  party_id: z.string().min(1, 'Party is required'),
  type: z.enum(['payment', 'receipt']),
  receipt_number: z.string().min(1, 'Number is required'),
  receipt_date: z.string().min(1, 'Date is required'),
  amount: z.number().positive('Amount must be positive'),
  payment_mode: z.enum(['cash', 'bank', 'cheque', 'upi', 'other']),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof schema>;

export default function Payments() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-receipts', page, search],
    queryFn: () => paymentReceiptsApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: PaymentForm) => paymentReceiptsApi.create(data as unknown as Partial<PaymentReceipt>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payment-receipts'] }); setShowModal(false); },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentForm>({ resolver: zodResolver(schema) });

  const columns: ColumnDef<PaymentReceipt, unknown>[] = [
    { accessorKey: 'receipt_number', header: 'Number' },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <Badge variant={getValue() === 'receipt' ? 'success' : 'info'}>{getValue() as string}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'receipt_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'payment_mode', header: 'Mode', cell: ({ getValue }) => <Badge>{(getValue() as string).toUpperCase()}</Badge> },
    { accessorKey: 'reference_number', header: 'Reference' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments & Receipts</h1>
        <Button onClick={() => { reset({ type: 'receipt', payment_mode: 'cash', receipt_date: new Date().toISOString().split('T')[0] } as PaymentForm); setShowModal(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Payment/Receipt
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Payment / Receipt" size="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select id="type" label="Type" options={[{ value: 'payment', label: 'Payment' }, { value: 'receipt', label: 'Receipt' }]} error={errors.type?.message} {...register('type')} />
            <Input id="receipt_number" label="Number" error={errors.receipt_number?.message} {...register('receipt_number')} />
            <Input id="party_id" label="Party ID" error={errors.party_id?.message} {...register('party_id')} />
            <Input id="receipt_date" label="Date" type="date" error={errors.receipt_date?.message} {...register('receipt_date')} />
            <Input id="amount" label="Amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Select id="payment_mode" label="Payment Mode" options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Other' }]} error={errors.payment_mode?.message} {...register('payment_mode')} />
            <Input id="reference_number" label="Reference Number" {...register('reference_number')} />
            <Input id="bank_name" label="Bank Name" {...register('bank_name')} />
          </div>
          <Input id="notes" label="Notes" {...register('notes')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
