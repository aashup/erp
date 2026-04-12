import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { godownsApi } from '@/api/inventory';
import type { Godown } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  is_default: z.boolean().optional(),
});

type GodownForm = z.infer<typeof schema>;

export default function Godowns() {
  usePageTitle('Godowns');
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editGodown, setEditGodown] = useState<Godown | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['godowns', sortBy, sortOrder],
    queryFn: () => godownsApi.list({ sort_by: sortBy, sort_order: sortOrder }),
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

  const columns: ColumnDef<Godown, unknown>[] = [
    {
      id: 'name',
      header: () => (
        <button
          onClick={() => handleSort('name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by name"
        >
          Name
          {renderSortIcon('name')}
        </button>
      ),
      accessorKey: 'name',
    },
    {
      id: 'code',
      header: () => (
        <button
          onClick={() => handleSort('code')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by code"
        >
          Code
          {renderSortIcon('code')}
        </button>
      ),
      accessorKey: 'code',
    },
    {
      id: 'address',
      header: () => (
        <button
          onClick={() => handleSort('address')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by address"
        >
          Address
          {renderSortIcon('address')}
        </button>
      ),
      accessorKey: 'address',
    },
    {
      id: 'is_default',
      header: () => (
        <button
          onClick={() => handleSort('is_default')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by default"
        >
          Default
          {renderSortIcon('is_default')}
        </button>
      ),
      cell: ({ row }) => row.original.is_default ? <Badge variant="info">Default</Badge> : '—',
    },
    {
      id: 'is_active',
      header: () => (
        <button
          onClick={() => handleSort('is_active')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by status"
        >
          Status
          {renderSortIcon('is_active')}
        </button>
      ),
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'danger'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge>,
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Godown</Button>
        </div>
      </div>
      <Card>
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

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>No additional filters available. All godowns are displayed.</p>
        </div>
      </FilterPanel>
    </div>
  );
}
