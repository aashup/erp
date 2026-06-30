import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineListQuery } from '@/hooks/useOfflineQuery';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { buildSyncRecord } from '@/lib/sync';
import api from '@/lib/axios';
import type { Branch, ApiResponse } from '@/types';
import { INDIAN_STATES } from '@/lib/constants';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
});

type BranchForm = z.infer<typeof schema>;

export default function Branches() {
  usePageTitle('Branches');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const isOnline = useOnlineStatus();
  const user = useAuthStore((s) => s.user);
  const canCreate = hasPermission('branch.create');
  const canEdit = hasPermission('branch.edit');
  const canDelete = hasPermission('branch.delete');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useOfflineListQuery({
    table: db.branches,
    queryKey: ['branches', search, codeFilter, cityFilter, addressFilter, sortBy, sortOrder],
    apiFn: () => api.get('/branches', {
      params: {
        ...(search ? { search } : {}),
        ...(codeFilter ? { code: codeFilter } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(addressFilter ? { address: addressFilter } : {}),
        sort_by: sortBy,
        sort_order: sortOrder,
      }
    }),
    offlineFilter: (items) => {
      let result = items;
      if (search) result = result.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
      if (codeFilter) result = result.filter((i) => i.code?.toLowerCase().includes(codeFilter.toLowerCase()));
      if (cityFilter) result = result.filter((i) => i.city?.toLowerCase().includes(cityFilter.toLowerCase()));
      if (addressFilter) result = result.filter((i) => i.address?.toLowerCase().includes(addressFilter.toLowerCase()));
      result = result.slice().sort((a, b) => {
        const aVal = String((a as unknown as Record<string, unknown>)[sortBy] ?? '');
        const bVal = String((b as unknown as Record<string, unknown>)[sortBy] ?? '');
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
      return result;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: BranchForm) => {
      const record = buildSyncRecord<Branch>(formData, user!.company_id);
      await db.branches.put(record);
      if (isOnline) {
        const res = await api.post<ApiResponse<Branch>>('/branches', formData);
        await db.branches.put({ ...res.data.data, sync_status: 'synced' });
        return res;
      }
      return { data: { data: record } };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: formData }: { id: string; data: Partial<BranchForm> }) => {
      const existing = await db.branches.get(id);
      const record = buildSyncRecord<Branch>(
        { ...existing, ...formData },
        user!.company_id,
        id,
        existing?.created_at,
      );
      await db.branches.put(record);
      if (isOnline) {
        const res = await api.put<ApiResponse<Branch>>(`/branches/${id}`, formData);
        await db.branches.put({ ...res.data.data, sync_status: 'synced' });
        return res;
      }
      return { data: { data: record } };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline) { toast.error('Cannot delete while offline'); throw new Error('offline'); }
      await api.delete(`/branches/${id}`);
      await db.branches.delete(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<BranchForm>({ resolver: zodResolver(schema) });

  const openCreate = () => { setEditBranch(null); reset({ name: '' }); setShowModal(true); };
  const openEdit = (b: Branch) => { setEditBranch(b); reset({ name: b.name, code: b.code ?? '', address: b.address ?? '', city: b.city ?? '', state: b.state ?? '', state_code: b.state_code ?? '' }); setShowModal(true); };

  const onSubmit = (formData: BranchForm) => {
    if (editBranch) updateMutation.mutate({ id: editBranch.id, data: formData });
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

  const columns: ColumnDef<Branch, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: () => (
        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Name {renderSortIcon('name')}
        </button>
      ),
    },
    {
      id: 'code',
      accessorKey: 'code',
      header: () => (
        <button onClick={() => handleSort('code')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Code {renderSortIcon('code')}
        </button>
      ),
    },
    {
      id: 'city',
      accessorKey: 'city',
      header: () => (
        <button onClick={() => handleSort('city')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          City {renderSortIcon('city')}
        </button>
      ),
    },
    {
      id: 'state',
      accessorKey: 'state',
      header: () => (
        <button onClick={() => handleSort('state')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          State {renderSortIcon('state')}
        </button>
      ),
    },
    {
      id: 'is_active',
      accessorKey: 'is_active',
      header: () => (
        <button onClick={() => handleSort('is_active')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Status {renderSortIcon('is_active')}
        </button>
      ),
      cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canEdit || canDelete ? [{
      id: 'actions', header: '',
      cell: ({ row }: { row: { original: Branch } }) => (
        <div className="flex items-center gap-1">
          {canEdit && <button onClick={() => openEdit(row.original)} disabled={!isOnline} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" /></button>}
          {canDelete && <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(row.original.id); }} disabled={!isOnline} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>}
        </div>
      ),
    } as ColumnDef<Branch, unknown>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Branches</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilterPanel(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>
          {canCreate && <Button onClick={openCreate} disabled={!isOnline}><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>}
        </div>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline — showing cached data. Edits will sync when back online.
        </div>
      )}

      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Manage company branches</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      {/* Filter Panel */}
      <FilterPanel open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
        {/* Search Input */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Name
            </label>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Code Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Code
            </label>
            {codeFilter && (
              <button
                onClick={() => setCodeFilter('')}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by code..."
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* City Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by City
            </label>
            {cityFilter && (
              <button
                onClick={() => setCityFilter('')}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by city..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Address Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Address
            </label>
            {addressFilter && (
              <button
                onClick={() => setAddressFilter('')}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by address..."
            value={addressFilter}
            onChange={(e) => setAddressFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setCodeFilter('');
            setCityFilter('');
            setAddressFilter('');
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editBranch ? 'Edit Branch' : 'New Branch'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
          <Input id="code" label="Code" {...register('code')} />
          <Input id="address" label="Address" {...register('address')} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="city" label="City" {...register('city')} />
            <SlideSelect
              name="state_code"
              label="State"
              placeholder="Select state"
              panelTitle="Select State"
              options={INDIAN_STATES}
              value={watch('state_code')}
              onChange={(val) =>
                setValue('state_code', val, { shouldValidate: true })
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editBranch ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
