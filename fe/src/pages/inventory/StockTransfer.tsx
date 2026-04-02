import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { stockLedgerApi, godownsApi, itemsApi } from '@/api/inventory';
import type { StockLedgerEntry } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { DataTable } from '@/components/ui/DataTable';

const transferSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  from_godown_id: z.string().min(1, 'Source godown is required'),
  to_godown_id: z.string().min(1, 'Destination godown is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  rate: z.coerce.number().min(0, 'Rate must be >= 0'),
  narration: z.string().optional(),
}).refine((d) => d.from_godown_id !== d.to_godown_id, {
  message: 'Source and destination must be different',
  path: ['to_godown_id'],
});

type TransferForm = z.infer<typeof transferSchema>;

export default function StockTransfer() {
  usePageTitle('Stock Transfer');
  const queryClient = useQueryClient();
  const [page] = useState(1);

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: recentTransfers, isLoading } = useQuery({
    queryKey: ['stock-ledger', 'transfers', page],
    queryFn: () => stockLedgerApi.list({ page: String(page), per_page: '10', type: 'transfer_out' }),
    select: (res) => res.data,
  });

  const mutation = useMutation({
    mutationFn: (data: TransferForm) => stockLedgerApi.createTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      toast.success('Stock transferred successfully');
      reset();
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Transfer failed';
      toast.error(msg);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TransferForm>({ resolver: zodResolver(transferSchema) as any });

  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: `${i.name} (${i.sku ?? ''})`, subtitle: i.sku ?? i.hsn_code ?? '' }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name }));

  const columns: ColumnDef<StockLedgerEntry, unknown>[] = [
    { accessorKey: 'created_at', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN') },
    { header: 'Item', cell: ({ row }) => row.original.item?.name ?? '—' },
    { header: 'From Godown', cell: ({ row }) => row.original.godown?.name ?? '—' },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ getValue }) => Math.abs(Number(getValue())) },
    { accessorKey: 'rate', header: 'Rate', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => (getValue() as string) ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Transfer</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transfer Stock Between Godowns</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SlideSelect name="item_id" label="Item" placeholder="Select item" panelTitle="Select Item" options={itemOptions} value={watch('item_id')} onChange={(val) => setValue('item_id', val, { shouldValidate: true })} error={errors.item_id?.message} />
              <SlideSelect name="from_godown_id" label="From Godown" placeholder="Select godown" panelTitle="Select Source Godown" options={godownOptions} value={watch('from_godown_id')} onChange={(val) => setValue('from_godown_id', val, { shouldValidate: true })} error={errors.from_godown_id?.message} />
              <SlideSelect name="to_godown_id" label="To Godown" placeholder="Select godown" panelTitle="Select Destination Godown" options={godownOptions} value={watch('to_godown_id')} onChange={(val) => setValue('to_godown_id', val, { shouldValidate: true })} error={errors.to_godown_id?.message} />
              <Input id="quantity" label="Quantity" type="number" step="0.001" error={errors.quantity?.message} {...register('quantity')} />
              <Input id="rate" label="Rate (₹)" type="number" step="0.01" error={errors.rate?.message} {...register('rate')} />
              <Input id="narration" label="Narration" error={errors.narration?.message} {...register('narration')} />
            </div>
            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
              <Button type="submit" loading={mutation.isPending}>Transfer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Transfers</h3>
        </CardHeader>
        <DataTable columns={columns} data={recentTransfers?.data ?? []} loading={isLoading} />
      </Card>
    </div>
  );
}
