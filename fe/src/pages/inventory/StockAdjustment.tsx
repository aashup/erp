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
import { Select } from '@/components/ui/Select';
import { DataTable } from '@/components/ui/DataTable';

const adjustmentSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  godown_id: z.string().min(1, 'Godown is required'),
  adjustment_type: z.enum(['add', 'reduce']),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  rate: z.coerce.number().min(0, 'Rate must be >= 0'),
  narration: z.string().min(3, 'Reason is required (min 3 characters)'),
});

type AdjustmentForm = z.infer<typeof adjustmentSchema>;

export default function StockAdjustment() {
  usePageTitle('Stock Adjustment');
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

  const { data: recentAdjustments, isLoading } = useQuery({
    queryKey: ['stock-ledger', 'adjustments', page],
    queryFn: () => stockLedgerApi.list({ page: String(page), per_page: '10', type: 'adjustment' }),
    select: (res) => res.data,
  });

  const mutation = useMutation({
    mutationFn: (data: AdjustmentForm) => {
      const qty = data.adjustment_type === 'reduce' ? -data.quantity : data.quantity;
      return stockLedgerApi.createAdjustment({
        item_id: data.item_id,
        godown_id: data.godown_id,
        quantity: qty,
        rate: data.rate,
        narration: data.narration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      toast.success('Stock adjustment recorded');
      reset();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema) as any,
    defaultValues: { adjustment_type: 'add' },
  });

  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: `${i.name} (${i.sku ?? ''})` }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name }));

  const columns: ColumnDef<StockLedgerEntry, unknown>[] = [
    { accessorKey: 'created_at', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN') },
    { header: 'Item', cell: ({ row }) => row.original.item?.name ?? '—' },
    { header: 'Godown', cell: ({ row }) => row.original.godown?.name ?? '—' },
    {
      accessorKey: 'quantity', header: 'Qty',
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return <span className={v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{v > 0 ? '+' : ''}{v}</span>;
      },
    },
    { accessorKey: 'rate', header: 'Rate', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'narration', header: 'Reason', cell: ({ getValue }) => (getValue() as string) ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Adjustment</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Physical Stock Adjustment / Write-off</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select id="item_id" label="Item" options={itemOptions} error={errors.item_id?.message} {...register('item_id')} />
              <Select id="godown_id" label="Godown" options={godownOptions} error={errors.godown_id?.message} {...register('godown_id')} />
              <Select
                id="adjustment_type"
                label="Adjustment Type"
                options={[{ value: 'add', label: 'Add Stock' }, { value: 'reduce', label: 'Reduce / Write-off' }]}
                error={errors.adjustment_type?.message}
                {...register('adjustment_type')}
              />
              <Input id="quantity" label="Quantity" type="number" step="0.001" error={errors.quantity?.message} {...register('quantity')} />
              <Input id="rate" label="Rate (₹)" type="number" step="0.01" error={errors.rate?.message} {...register('rate')} />
            </div>
            <Input id="narration" label="Reason (required)" error={errors.narration?.message} {...register('narration')} />
            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
              <Button type="submit" loading={mutation.isPending}>Record Adjustment</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Adjustments</h3>
        </CardHeader>
        <DataTable columns={columns} data={recentAdjustments?.data ?? []} loading={isLoading} />
      </Card>
    </div>
  );
}
