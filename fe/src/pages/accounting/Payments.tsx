import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { paymentReceiptsApi } from '@/api/accounting';
import { partiesApi } from '@/api/parties';
import type { PaymentReceipt } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
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

type PaymentForm = z.infer<typeof schema>;

export default function Payments() {
  usePageTitle('Payments');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<PaymentReceipt | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-receipts', page, search],
    queryFn: () => paymentReceiptsApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const { data: partiesData } = useQuery({
    queryKey: ['parties-all'],
    queryFn: () => partiesApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: PaymentForm) => paymentReceiptsApi.create(data as unknown as Partial<PaymentReceipt>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payment-receipts'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentReceiptsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-receipts'] }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PaymentForm>({ resolver: zodResolver(schema) as any });

  const openCreate = () => {
    setEditRecord(null);
    reset({ type: 'receipt', payment_mode: 'cash', receipt_date: new Date().toISOString().split('T')[0], amount: undefined, receipt_number: '', party_id: '', reference_number: '', bank_name: '', notes: '' } as unknown as PaymentForm);
    setShowModal(true);
  };

  const openEdit = (record: PaymentReceipt) => {
    setEditRecord(record);
    reset({
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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRecord(null);
    reset();
  };

  const onSubmit = (formData: PaymentForm) => {
    createMutation.mutate(formData);
  };

  const partyOptions = (partiesData?.data ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }));

  const columns: ColumnDef<PaymentReceipt, unknown>[] = [
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
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this record?')) deleteMutation.mutate(row.original.id); }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payments & Receipts</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Payment/Receipt
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
      <Modal open={showModal} onClose={closeModal} title={editRecord ? 'Edit Payment/Receipt' : 'New Payment/Receipt'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SlideSelect name="type" label="Type" placeholder="Select type" panelTitle="Select Type" options={[{ value: 'payment', label: 'Payment (You Pay)' }, { value: 'receipt', label: 'Receipt (You Receive)' }]} value={watch('type')} onChange={(val) => setValue('type', val as 'payment' | 'receipt', { shouldValidate: true })} error={errors.type?.message} />
            <Input id="receipt_number" label="Number" error={errors.receipt_number?.message} {...register('receipt_number')} />
            <SlideSelect name="party_id" label="Party" placeholder="Select party" panelTitle="Select Party" options={partyOptions} value={watch('party_id')} onChange={(val) => setValue('party_id', val, { shouldValidate: true })} error={errors.party_id?.message} />
            <Input id="receipt_date" label="Date" type="date" error={errors.receipt_date?.message} {...register('receipt_date')} />
            <Input id="amount" label="Amount (₹)" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <SlideSelect name="payment_mode" label="Payment Mode" placeholder="Select mode" panelTitle="Payment Mode" options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Other' }]} value={watch('payment_mode')} onChange={(val) => setValue('payment_mode', val as 'cash' | 'bank' | 'cheque' | 'upi' | 'other', { shouldValidate: true })} error={errors.payment_mode?.message} />
            <Input id="reference_number" label="Reference Number" {...register('reference_number')} />
            <Input id="bank_name" label="Bank Name" {...register('bank_name')} />
          </div>
          <Input id="notes" label="Notes" {...register('notes')} />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>
              {editRecord ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
