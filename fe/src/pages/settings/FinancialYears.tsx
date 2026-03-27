import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { financialYearsApi } from '@/api/financialYears';
import type { FinancialYear } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, Star, Lock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  label: z.string().min(1, 'Label is required (e.g. 2024-25)'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_current: z.boolean().optional(),
});

type FYForm = z.infer<typeof schema>;

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function FinancialYears() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editFY, setEditFY] = useState<FinancialYear | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['financial-years'],
    queryFn: () => financialYearsApi.list({ per_page: '50' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: FYForm) => financialYearsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-years'] });
      closeModal();
      toast.success('Financial year created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FYForm & { is_locked: boolean }> }) =>
      financialYearsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-years'] });
      closeModal();
      toast.success('Financial year updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financialYearsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-years'] });
      toast.success('Financial year deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Cannot delete'),
  });

  const setCurrentMutation = useMutation({
    mutationFn: (id: string) => financialYearsApi.setCurrent(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['financial-years'] });
      toast.success(res.data.message || 'Default financial year updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      financialYearsApi.update(id, { is_locked: locked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-years'] });
      toast.success('Lock status updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FYForm>({
    resolver: zodResolver(schema),
  });

  const openCreate = () => {
    setEditFY(null);
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    reset({
      label: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      start_date: `${fyStartYear}-04-01`,
      end_date: `${fyStartYear + 1}-03-31`,
      is_current: false,
    });
    setShowModal(true);
  };

  const openEdit = (fy: FinancialYear) => {
    setEditFY(fy);
    reset({
      label: fy.label,
      start_date: fy.start_date.slice(0, 10),
      end_date: fy.end_date.slice(0, 10),
      is_current: fy.is_current,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditFY(null);
    reset();
  };

  const onSubmit = (formData: FYForm) => {
    if (editFY) {
      updateMutation.mutate({ id: editFY.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<FinancialYear, unknown>[] = [
    { accessorKey: 'label', header: 'Financial Year' },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      accessorKey: 'is_current',
      header: 'Default',
      cell: ({ row }) =>
        row.original.is_current ? (
          <Badge variant="success">
            <Star className="mr-1 h-3 w-3" /> Current
          </Badge>
        ) : (
          <button
            onClick={() => setCurrentMutation.mutate(row.original.id)}
            disabled={setCurrentMutation.isPending}
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-primary-50 hover:text-primary-700 dark:text-gray-400 dark:hover:bg-primary-900/30 dark:hover:text-primary-300"
          >
            Set as default
          </button>
        ),
    },
    {
      accessorKey: 'is_locked',
      header: 'Lock',
      cell: ({ row }) => {
        const fy = row.original;
        return (
          <button
            onClick={() => toggleLockMutation.mutate({ id: fy.id, locked: !fy.is_locked })}
            disabled={toggleLockMutation.isPending}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={fy.is_locked ? 'Unlock this year' : 'Lock this year'}
          >
            {fy.is_locked ? (
              <Lock className="h-4 w-4 text-red-500" />
            ) : (
              <Unlock className="h-4 w-4 text-green-500" />
            )}
          </button>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row.original)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          {!row.original.is_current && (
            <button
              onClick={() => {
                if (confirm('Delete this financial year?')) deleteMutation.mutate(row.original.id);
              }}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financial Years</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Financial Year
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage financial years. The <strong>current</strong> year is used as default for all new entries. Lock a year to prevent any changes.
          </p>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editFY ? 'Edit Financial Year' : 'New Financial Year'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="label"
            label="Label"
            placeholder="2024-25"
            error={errors.label?.message}
            {...register('label')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="start_date"
              label="Start Date"
              type="date"
              error={errors.start_date?.message}
              {...register('start_date')}
            />
            <Input
              id="end_date"
              label="End Date"
              type="date"
              error={errors.end_date?.message}
              {...register('end_date')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="rounded" {...register('is_current')} />
            Set as current (default) financial year
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editFY ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
