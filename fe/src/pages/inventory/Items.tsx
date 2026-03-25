import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { itemsApi } from '@/api/inventory';
import type { Item } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  hsn_code: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  category: z.string().optional(),
  gst_rate: z.number().min(0),
  mrp: z.union([z.number(), z.nan()]).transform((val) => (isNaN(val) ? undefined : val)).optional(),
  purchase_price: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
  reorder_level: z.number().int().min(0).optional(),
  is_batch_tracked: z.boolean().optional(),
});

type ItemForm = z.infer<typeof itemSchema>;

export default function Items() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['items', page, search],
    queryFn: () => itemsApi.list({ page: String(page), search, per_page: '25' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: ItemForm) => itemsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ItemForm> }) =>
      itemsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { gst_rate: 18 },
  });

  const openCreate = () => {
    setEditItem(null);
    reset({ name: '', sku: '', hsn_code: '', unit: 'PCS', category: '', gst_rate: 18, is_batch_tracked: false });
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    reset({
      name: item.name,
      sku: item.sku ?? '',
      hsn_code: item.hsn_code ?? '',
      unit: item.unit,
      category: item.category ?? '',
      gst_rate: item.gst_rate,
      mrp: item.mrp ?? undefined,
      purchase_price: item.purchase_price ?? undefined,
      selling_price: item.selling_price ?? undefined,
      reorder_level: item.reorder_level ?? undefined,
      is_batch_tracked: item.is_batch_tracked,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    reset();
  };

  const onSubmit = (formData: ItemForm) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<Item, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'hsn_code', header: 'HSN' },
    { accessorKey: 'unit', header: 'Unit' },
    { accessorKey: 'category', header: 'Category' },
    {
      accessorKey: 'gst_rate',
      header: 'GST %',
      cell: ({ getValue }) => `${getValue()}%`,
    },
    {
      accessorKey: 'selling_price',
      header: 'Price',
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v ? formatCurrency(v) : '—';
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'success' : 'danger'}>
          {getValue() ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100">
            <Pencil className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this item?')) deleteMutation.mutate(row.original.id);
            }}
            className="rounded p-1 hover:bg-gray-100"
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
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Search items..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && (
          <Pagination
            currentPage={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editItem ? 'Edit Item' : 'New Item'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
            <Input id="sku" label="SKU" error={errors.sku?.message} {...register('sku')} />
            <Input id="hsn_code" label="HSN Code" {...register('hsn_code')} />
            <Select
              id="unit"
              label="Unit"
              options={[
                { value: 'PCS', label: 'Pieces' },
                { value: 'KG', label: 'Kilograms' },
                { value: 'BOX', label: 'Box' },
                { value: 'STRIP', label: 'Strip' },
              ]}
              error={errors.unit?.message}
              {...register('unit')}
            />
            <Input id="category" label="Category" {...register('category')} />
            <Input id="gst_rate" label="GST Rate (%)" type="number" step="0.01" error={errors.gst_rate?.message} {...register('gst_rate', { valueAsNumber: true })} />
            <Input id="mrp" label="MRP" type="number" step="0.01" error={errors.mrp?.message} {...register('mrp', { valueAsNumber: true })} />
            <Input id="purchase_price" label="Purchase Price" type="number" step="0.01" error={errors.purchase_price?.message} {...register('purchase_price', { valueAsNumber: true })} />
            <Input id="selling_price" label="Selling Price" type="number" step="0.01" error={errors.selling_price?.message} {...register('selling_price', { valueAsNumber: true })} />
            <Input id="reorder_level" label="Reorder Level" type="number" error={errors.reorder_level?.message} {...register('reorder_level', { valueAsNumber: true })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_batch_tracked" {...register('is_batch_tracked')} className="rounded" />
            <label htmlFor="is_batch_tracked" className="text-sm text-gray-700">Track batches & expiry</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
