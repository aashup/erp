import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { designationsApi } from '@/api/payroll';
import type { Designation } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});
type FormData = z.infer<typeof schema>;

interface DesignationFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (designation: Designation) => void;
}

export function DesignationFormModal({ open, onClose, onCreated }: DesignationFormModalProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => designationsApi.create(data),
    onSuccess: (res) => {
      const designation = res.data.data as Designation;
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      toast.success('Designation created');
      reset();
      onCreated?.(designation);
      onClose();
    },
    onError: () => toast.error('Failed to create designation'),
  });

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="New Designation">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
