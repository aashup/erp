import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { batchesApi } from '@/api/inventory';
import type { Batch } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

const schema = z.object({
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

type BatchFormData = z.infer<typeof schema>;

interface BatchFormModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName?: string;
  onCreated?: (batch: Batch) => void;
}

export function BatchFormModal({ open, onClose, itemId, itemName, onCreated }: BatchFormModalProps) {
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BatchFormData>({
    resolver: zodResolver(schema) as any,
  });

  const mutation = useMutation({
    mutationFn: (data: BatchFormData) => batchesApi.create(itemId, data),
    onSuccess: (res) => {
      const batch = res.data.data as Batch;
      queryClient.invalidateQueries({ queryKey: ['batches', itemId] });
      toast.success('Batch created');
      reset();
      onCreated?.(batch);
      onClose();
    },
    onError: () => toast.error('Failed to create batch'),
  });

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = (data: BatchFormData) => mutation.mutate(data);

  return (
    <Modal open={open} onClose={handleClose} title={itemName ? `New Batch — ${itemName}` : 'New Batch'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              id="batch_number"
              label="Batch Number"
              placeholder="e.g. BT-2024-001"
              error={errors.batch_number?.message}
              {...register('batch_number')}
            />
          </div>
          <Input id="manufacturing_date" label="Manufacturing Date" type="date" {...register('manufacturing_date')} />
          <Input
            id="expiry_date"
            label="Expiry Date"
            type="date"
            error={errors.expiry_date?.message}
            {...register('expiry_date')}
          />
          <Input id="purchase_price" label="Purchase Price (₹)" type="number" step="0.01" min="0" {...register('purchase_price')} />
          <Input id="selling_price" label="Selling Price (₹)" type="number" step="0.01" min="0" {...register('selling_price')} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
