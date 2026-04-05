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
import { ArrowUp, ArrowDown } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    queryKey: ['stock-ledger', 'adjustments', page, sortBy, sortOrder],
    queryFn: () => stockLedgerApi.list({ page: String(page), per_page: '10', type: 'adjustment', sort_by: sortBy, sort_order: sortOrder }),
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
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema) as any,
    defaultValues: { adjustment_type: 'add' },
  });

  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: `${i.name} (${i.sku ?? ''})`, subtitle: i.sku ?? i.hsn_code ?? '' }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name }));

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns: ColumnDef<StockLedgerEntry, unknown>[] = [
    {
      id: 'created_at',
      header: () => (
        <button
          onClick={() => handleSort('created_at')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by date"
        >
          Date
          {renderSortIcon('created_at')}
        </button>
      ),
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('en-IN'),
    },
    {
      id: 'item_name',
      header: () => (
        <button
          onClick={() => handleSort('item_name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by item"
        >
          Item
          {renderSortIcon('item_name')}
        </button>
      ),
      cell: ({ row }) => row.original.item?.name ?? '—',
    },
    {
      id: 'godown_name',
      header: () => (
        <button
          onClick={() => handleSort('godown_name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by godown"
        >
          Godown
          {renderSortIcon('godown_name')}
        </button>
      ),
      cell: ({ row }) => row.original.godown?.name ?? '—',
    },
    {
      id: 'quantity',
      header: () => (
        <button
          onClick={() => handleSort('quantity')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by quantity"
        >
          Qty
          {renderSortIcon('quantity')}
        </button>
      ),
      cell: ({ row }) => {
        const v = Number(row.original.quantity);
        return <span className={v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{v > 0 ? '+' : ''}{v}</span>;
      },
    },
    {
      id: 'rate',
      header: () => (
        <button
          onClick={() => handleSort('rate')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by rate"
        >
          Rate
          {renderSortIcon('rate')}
        </button>
      ),
      cell: ({ row }) => formatCurrency(row.original.rate),
    },
    {
      id: 'narration',
      header: () => (
        <button
          onClick={() => handleSort('narration')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by reason"
        >
          Reason
          {renderSortIcon('narration')}
        </button>
      ),
      cell: ({ row }) => row.original.narration ?? '—',
    },
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
              <SlideSelect name="item_id" label="Item" placeholder="Select item" panelTitle="Select Item" options={itemOptions} value={watch('item_id')} onChange={(val) => setValue('item_id', val, { shouldValidate: true })} error={errors.item_id?.message} />
              <SlideSelect name="godown_id" label="Godown" placeholder="Select godown" panelTitle="Select Godown" options={godownOptions} value={watch('godown_id')} onChange={(val) => setValue('godown_id', val, { shouldValidate: true })} error={errors.godown_id?.message} />
              <SlideSelect
                name="adjustment_type"
                label="Adjustment Type"
                placeholder="Select type"
                panelTitle="Adjustment Type"
                options={[{ value: 'add', label: 'Add Stock' }, { value: 'reduce', label: 'Reduce / Write-off' }]}
                value={watch('adjustment_type')}
                onChange={(val) => setValue('adjustment_type', val as 'add' | 'reduce', { shouldValidate: true })}
                error={errors.adjustment_type?.message}
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
