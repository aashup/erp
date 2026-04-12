import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { unitsApi } from '@/api/inventory';
import type { Unit } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const unitSchema = z.object({
  value: z.string().min(1, 'Code is required').max(20),
  label: z.string().min(1, 'Label is required').max(255),
  status: z.enum(['active', 'inactive']),
});

type UnitForm = z.infer<typeof unitSchema>;

const defaultValues: UnitForm = {
  value: '',
  label: '',
  status: 'active',
};

export default function Units() {
  usePageTitle('Units');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editItem, setEditItem] = useState<Unit | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['units', page, search, statusFilter, sortBy, sortOrder],
    queryFn: () => unitsApi.list({
      page: String(page),
      search,
      ...(statusFilter ? { status: statusFilter } : {}),
      sort_by: sortBy,
      sort_order: sortOrder
    }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Unit>) => unitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      closeModal();
      toast.success('Unit created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Unit> }) => unitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      closeModal();
      toast.success('Unit updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unit deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<UnitForm>({
    resolver: zodResolver(unitSchema) as any,
    defaultValues,
  });

  const openCreate = () => {
    setEditItem(null);
    reset(defaultValues);
    setShowModal(true);
  };

  const openEdit = (unit: Unit) => {
    setEditItem(unit);
    reset({
      value: unit.value,
      label: unit.label,
      status: unit.status,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    reset(defaultValues);
  };

  const onSubmit = (formData: UnitForm) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (unit: Unit) => {
    if (confirm(`Delete unit "${unit.label}"?`)) {
      deleteMutation.mutate(unit.id);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns: ColumnDef<Unit, unknown>[] = [
    {
      id: 'value',
      accessorKey: 'value',
      header: () => (
        <button onClick={() => handleSort('value')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Code {renderSortIcon('value')}
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.value}</span>
      )
    },
    {
      id: 'label',
      accessorKey: 'label',
      header: () => (
        <button onClick={() => handleSort('label')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Label {renderSortIcon('label')}
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.label}</span>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => (
        <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Status {renderSortIcon('status')}
        </button>
      ),
      cell: ({ getValue }) => (
        <Badge variant={getValue() === 'active' ? 'success' : 'default'}>
          {getValue() === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button onClick={() => handleDelete(row.original)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Units</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Unit</Button>
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editItem ? 'Edit Unit' : 'New Unit'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="value"
              label="Code"
              placeholder="PCS"
              error={errors.value?.message}
              {...register('value')}
            />
            <Input
              id="label"
              label="Label"
              placeholder="Pieces"
              error={errors.label?.message}
              {...register('label')}
            />
          </div>

          <SlideSelect
            name="status"
            label="Status"
            placeholder="Select..."
            panelTitle="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={watch('status')}
            onChange={(val) => setValue('status', val as 'active' | 'inactive', { shouldValidate: true })}
            error={errors.status?.message}
          />

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Search */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search unit..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Status Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Status
            </label>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <SlideSelect
            name="statusFilter"
            placeholder="All Statuses"
            panelTitle="Filter by Status"
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setStatusFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
    </div>
  );
}
