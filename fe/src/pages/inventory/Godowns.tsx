import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { godownsApi } from '@/api/inventory';
import type { Godown } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  is_default: z.boolean().optional(),
});

type GodownForm = z.infer<typeof schema>;

export default function Godowns() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editGodown, setEditGodown] = useState<Godown | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['godowns'],
    queryFn: () => godownsApi.list(),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: GodownForm) => godownsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['godowns'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GodownForm> }) => godownsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['godowns'] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => godownsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['godowns'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GodownForm>({ resolver: zodResolver(schema) });

  const openCreate = () => { setEditGodown(null); reset({ name: '', code: '', address: '', is_default: false }); setShowModal(true); };
  const openEdit = (g: Godown) => { setEditGodown(g); reset({ name: g.name, code: g.code ?? '', address: g.address ?? '', is_default: g.is_default }); setShowModal(true); };

  const onSubmit = (formData: GodownForm) => {
    if (editGodown) updateMutation.mutate({ id: editGodown.id, data: formData });
    else createMutation.mutate(formData);
  };

  const columns: ColumnDef<Godown, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'address', header: 'Address' },
    {
      accessorKey: 'is_default',
      header: 'Default',
      cell: ({ getValue }) => getValue() ? <Badge variant="info">Default</Badge> : '—',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" /></button>
          <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(row.original.id); }} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Godowns / Warehouses</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Godown</Button>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Manage your warehouses and storage locations</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editGodown ? 'Edit Godown' : 'New Godown'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
          <Input id="code" label="Code" {...register('code')} />
          <Input id="address" label="Address" {...register('address')} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_default" {...register('is_default')} className="rounded" />
            <label htmlFor="is_default" className="text-sm text-gray-700 dark:text-gray-300">Default godown</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editGodown ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
