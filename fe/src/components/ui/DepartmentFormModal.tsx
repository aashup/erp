import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { departmentsApi } from '@/api/payroll';
import type { Department } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});
type FormData = z.infer<typeof schema>;

interface DepartmentFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (department: Department) => void;
}

export function DepartmentFormModal({ open, onClose, onCreated }: DepartmentFormModalProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => departmentsApi.create(data),
    onSuccess: (res) => {
      const department = res.data.data as Department;
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created');
      reset();
      onCreated?.(department);
      onClose();
    },
    onError: () => toast.error('Failed to create department'),
  });

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="New Department">
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
