import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { itemsApi, batchesApi } from '@/api/inventory';
import type { Batch } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const batchSchema = z.object({
  batch_number: z.string().min(1, 'Batch number is required'),
  manufacturing_date: z.string().optional(),
  expiry_date: z.string().optional(),
  purchase_price: z.union([z.coerce.number().min(0), z.nan()])
    .transform((val) => (isNaN(val as number) ? undefined : val))
    .optional(),
  selling_price: z.union([z.coerce.number().min(0), z.nan()])
    .transform((val) => (isNaN(val as number) ? undefined : val))
    .optional(),
}).refine(
  (data) => {
    if (data.manufacturing_date && data.expiry_date) {
      return data.expiry_date >= data.manufacturing_date;
    }
    return true;
  },
  { message: 'Expiry date must be on or after manufacturing date', path: ['expiry_date'] }
);

type BatchForm = z.infer<typeof batchSchema>;

function getExpiryStatus(expiryDate: string | null): {
  label: string;
  variant: 'danger' | 'warning' | 'success' | 'default';
} {
  if (!expiryDate) return { label: 'No Expiry', variant: 'default' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Expired', variant: 'danger' };
  if (diffDays <= 30) return { label: 'Expiring Soon', variant: 'warning' };
  return { label: 'OK', variant: 'success' };
}

export default function ItemBatches() {
  usePageTitle('Batches');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { itemId } = useParams<{ itemId: string }>();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('inventory.edit');
  const canDelete = hasPermission('inventory.delete');
  const canCreate = hasPermission('inventory.create');

  const [showModal, setShowModal] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);

  const { data: itemData } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => itemsApi.get(itemId!),
    select: (res) => res.data.data,
    enabled: !!itemId,
  });

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches', itemId],
    queryFn: () => batchesApi.list(itemId!),
    select: (res) => res.data.data as Batch[],
    enabled: !!itemId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BatchForm>({
    resolver: zodResolver(batchSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  const createMutation = useMutation({
    mutationFn: (data: BatchForm) => batchesApi.create(itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', itemId] });
      closeModal();
      toast.success('Batch added');
    },
    onError: () => toast.error('Failed to add batch'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BatchForm> }) =>
      batchesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', itemId] });
      closeModal();
      toast.success('Batch updated');
    },
    onError: () => toast.error('Failed to update batch'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => batchesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', itemId] });
      toast.success('Batch deleted');
    },
    onError: (err: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const msg = err?.response?.data?.message ?? 'Failed to delete batch';
      toast.error(msg);
    },
  });

  const openCreate = () => {
    setEditBatch(null);
    reset({ batch_number: '', manufacturing_date: '', expiry_date: '' });
    setShowModal(true);
  };

  const openEdit = (batch: Batch) => {
    setEditBatch(batch);
    reset({
      batch_number: batch.batch_number,
      manufacturing_date: batch.manufacturing_date ?? '',
      expiry_date: batch.expiry_date ?? '',
      purchase_price: batch.purchase_price ?? undefined,
      selling_price: batch.selling_price ?? undefined,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditBatch(null);
    reset();
  };

  const onSubmit = (formData: BatchForm) => {
    if (editBatch) {
      updateMutation.mutate({ id: editBatch.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Warn if any batches are expired or expiring soon
  const expiredCount = (batches ?? []).filter(
    (b) => b.expiry_date && new Date(b.expiry_date) < new Date()
  ).length;
  const expiringSoonCount = (batches ?? []).filter((b) => {
    if (!b.expiry_date) return false;
    const diff = Math.ceil(
      (new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return diff >= 0 && diff <= 30;
  }).length;

  const columns: ColumnDef<Batch, unknown>[] = [
    {
      id: 'batch_number',
      header: 'Batch No',
      accessorKey: 'batch_number',
    },
    {
      id: 'manufacturing_date',
      header: 'Mfg Date',
      cell: ({ row }) =>
        row.original.manufacturing_date ? formatDate(row.original.manufacturing_date) : '—',
    },
    {
      id: 'expiry_date',
      header: 'Expiry Date',
      cell: ({ row }) => {
        const { label, variant } = getExpiryStatus(row.original.expiry_date);
        return (
          <div className="flex items-center gap-2">
            <span>{row.original.expiry_date ? formatDate(row.original.expiry_date) : '—'}</span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        );
      },
    },
    {
      id: 'purchase_price',
      header: 'Purchase Price',
      cell: ({ row }) =>
        row.original.purchase_price != null ? formatCurrency(row.original.purchase_price) : '—',
    },
    {
      id: 'selling_price',
      header: 'Selling Price',
      cell: ({ row }) =>
        row.original.selling_price != null ? formatCurrency(row.original.selling_price) : '—',
    },
    {
      id: 'current_stock',
      header: 'Stock',
      cell: ({ row }) => {
        const stock = row.original.current_stock ?? 0;
        return (
          <span className={stock === 0 ? 'text-gray-400 dark:text-gray-500' : ''}>
            {stock} {itemData?.unit ?? ''}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={() => openEdit(row.original)}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Edit batch"
            >
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this batch? This will only work if the batch has zero stock.')) {
                  deleteMutation.mutate(row.original.id);
                }
              }}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Delete batch"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory/items')}
            className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Back to Items"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Batches{itemData ? ` — ${itemData.name}` : ''}
            </h1>
            {itemData && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {itemData.unit} · HSN: {itemData.hsn_code || '—'}
              </p>
            )}
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Batch
          </Button>
        )}
      </div>

      {/* Expiry alerts */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span><strong>{expiredCount}</strong> batch{expiredCount > 1 ? 'es' : ''} expired</span>
            </div>
          )}
          {expiringSoonCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span><strong>{expiringSoonCount}</strong> batch{expiringSoonCount > 1 ? 'es' : ''} expiring within 30 days</span>
            </div>
          )}
        </div>
      )}

      {/* Batch table */}
      <Card>
        <DataTable columns={columns} data={batches ?? []} loading={isLoading} />
        {!isLoading && (batches ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No batches yet. Click <strong>Add Batch</strong> to create the first batch.
          </p>
        )}
      </Card>

      {/* Add / Edit Batch Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editBatch ? 'Edit Batch' : 'Add Batch'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="batch_number"
            label="Batch Number"
            placeholder="e.g. BT-2024-001"
            error={errors.batch_number?.message}
            {...register('batch_number')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="manufacturing_date"
              label="Manufacturing Date"
              type="date"
              error={errors.manufacturing_date?.message}
              {...register('manufacturing_date')}
            />
            <Input
              id="expiry_date"
              label="Expiry Date"
              type="date"
              error={errors.expiry_date?.message}
              {...register('expiry_date')}
            />
            <Input
              id="purchase_price"
              label="Purchase Price"
              type="number"
              step="0.01"
              placeholder="Optional"
              error={errors.purchase_price?.message}
              {...register('purchase_price', { valueAsNumber: true })}
            />
            <Input
              id="selling_price"
              label="Selling Price"
              type="number"
              step="0.01"
              placeholder="Optional"
              error={errors.selling_price?.message}
              {...register('selling_price', { valueAsNumber: true })}
            />
          </div>
          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editBatch ? 'Update' : 'Add Batch'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
