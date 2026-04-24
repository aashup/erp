import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { departmentsApi } from '@/api/payroll';
import type { Department } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  is_active: z.boolean().optional(),
});
type DeptForm = z.infer<typeof schema>;

export default function Departments() {
  usePageTitle('Departments');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('payroll.create');
  const canEdit   = hasPermission('payroll.edit');
  const canDelete = hasPermission('payroll.delete');

  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState<Department | null>(null);
  const [search, setSearch]         = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['departments', search],
    queryFn: () => departmentsApi.list({ ...(search ? { search } : {}) }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (d: DeptForm) => departmentsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setShowModal(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeptForm> }) => departmentsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setShowModal(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeptForm>({ resolver: zodResolver(schema) });

  const openCreate = () => { setEditItem(null); reset({ name: '', is_active: true }); setShowModal(true); };
  const openEdit   = (d: Department) => { setEditItem(d); reset({ name: d.name, is_active: d.is_active }); setShowModal(true); };
  const onSubmit   = (fd: DeptForm) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data: fd });
    else createMutation.mutate(fd);
  };

  const columns: ColumnDef<Department, unknown>[] = [
    { id: 'name', accessorKey: 'name', header: 'Name' },
    {
      id: 'is_active', accessorKey: 'is_active', header: 'Status',
      cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canEdit || canDelete ? [{
      id: 'actions', header: '',
      cell: ({ row }: { row: { original: Department } }) => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => { if (confirm('Delete department?')) deleteMutation.mutate(row.original.id); }} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    } as ColumnDef<Department, unknown>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Departments</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          {canCreate && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Department</Button>}
        </div>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Manage employee departments</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Department' : 'New Department'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name" label="Department Name" error={errors.name?.message} {...register('name')} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" {...register('is_active')} className="rounded" />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
