import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { ledgersApi, accountingGroupsApi } from '@/api/accounting';
import type { AccountingGroup, Ledger } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown, WifiOff } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const ledgerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  alias: z.string().optional().nullable(),
  group_id: z.string().min(1, 'Group is required'),
  opening_balance: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  opening_type: z.enum(['dr', 'cr']),
  opening_date: z.string().optional().nullable(),
  is_bill_wise: z.boolean(),
  is_cost_center_applicable: z.boolean(),
  allow_manual_entry: z.boolean(),
});

type LedgerForm = z.infer<typeof ledgerSchema>;

const defaultValues: LedgerForm = {
  name: '',
  alias: '',
  group_id: '',
  opening_balance: 0,
  opening_type: 'dr',
  opening_date: '',
  is_bill_wise: false,
  is_cost_center_applicable: false,
  allow_manual_entry: true,
};


export default function Ledgers() {
  usePageTitle('Ledgers');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const isOnline = useOnlineStatus();
  const { user } = useAuthStore();
  const canCreate = hasPermission('accounting.create');
  const canEdit = hasPermission('accounting.edit');
  const canDelete = hasPermission('accounting.delete');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editItem, setEditItem] = useState<Ledger | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ledgers', page, search, groupFilter, sortBy, sortOrder, isOnline],
    queryFn: async () => {
      if (!isOnline) {
        // Offline: read from Dexie IndexedDB
        let items = await db.ledgers
          .where('company_id').equals(user!.company_id)
          .toArray();
        if (search) {
          const q = search.toLowerCase();
          items = items.filter(l =>
            l.name.toLowerCase().includes(q) || (l.alias ?? '').toLowerCase().includes(q)
          );
        }
        if (groupFilter) {
          items = items.filter(l => l.group_id === groupFilter);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items.sort((a, b) => {
          const av = String((a as any)[sortBy] ?? '');
          const bv = String((b as any)[sortBy] ?? '');
          return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        return {
          data: {
            data: items,
            current_page: 1,
            last_page: 1,
            total: items.length,
            per_page: items.length,
          },
        };
      }
      // Online: fetch from API and cache results into Dexie
      const res = await ledgersApi.list({
        page: String(page),
        search,
        ...(groupFilter ? { group_id: groupFilter } : {}),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      for (const ledger of res.data.data) {
        await db.ledgers.put({ ...ledger, sync_status: 'synced' });
      }
      return res;
    },
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Ledger>) => ledgersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ledgers'] }); closeModal(); toast.success('Ledger created'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Ledger> }) => ledgersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ledgers'] }); closeModal(); toast.success('Ledger updated'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ledgersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ledgers'] }); toast.success('Ledger deleted'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<LedgerForm>({
    resolver: zodResolver(ledgerSchema) as any,
    defaultValues,
  });

  const openCreate = () => {
    setEditItem(null);
    reset(defaultValues);
    setShowModal(true);
  };

  const openEdit = (ledger: Ledger) => {
    setEditItem(ledger);
    reset({
      name: ledger.name,
      alias: ledger.alias ?? '',
      group_id: ledger.group_id,
      opening_balance: ledger.opening_balance,
      opening_type: ledger.opening_type,
      opening_date: ledger.opening_date ?? '',
      is_bill_wise: ledger.is_bill_wise,
      is_cost_center_applicable: ledger.is_cost_center_applicable,
      allow_manual_entry: ledger.allow_manual_entry,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    reset(defaultValues);
  };

  const onSubmit = (formData: LedgerForm) => {
    const payload = {
      ...formData,
      alias: formData.alias || null,
      opening_date: formData.opening_date || null,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (ledger: Ledger) => {
    if (ledger.is_system) {
      toast.error('System ledgers cannot be deleted');
      return;
    }
    if (confirm(`Delete ledger "${ledger.name}"?`)) {
      deleteMutation.mutate(ledger.id);
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

  const columns: ColumnDef<Ledger, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: () => (
        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Name {renderSortIcon('name')}
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          {row.original.alias && <span className="ml-2 text-xs text-gray-400">({row.original.alias})</span>}
        </div>
      )
    },
    {
      id: 'group',
      accessorKey: 'group',
      header: () => (
        <button onClick={() => handleSort('group')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Group {renderSortIcon('group')}
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.group?.name ?? '—'}</span>
      )
    },
    {
      id: 'opening_balance',
      accessorKey: 'opening_balance',
      header: () => (
        <button onClick={() => handleSort('opening_balance')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Opening Balance {renderSortIcon('opening_balance')}
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.opening_balance > 0
            ? `${formatCurrency(row.original.opening_balance)} ${row.original.opening_type.toUpperCase()}`
            : '—'}
        </span>
      )
    },
    {
      id: 'is_system',
      accessorKey: 'is_system',
      header: () => (
        <button onClick={() => handleSort('is_system')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Type {renderSortIcon('is_system')}
        </button>
      ),
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'info' : 'default'}>{getValue() ? 'System' : 'Manual'}</Badge>
      )
    },
    ...(canEdit || canDelete ? [{
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: Ledger } }) => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={() => openEdit(row.original)}
              disabled={!isOnline}
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
            >
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && !row.original.is_system && (
            <button
              onClick={() => handleDelete(row.original)}
              disabled={!isOnline}
              className="rounded p-1 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/30"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    } as ColumnDef<Ledger, unknown>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ledgers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <Button onClick={openCreate} disabled={!isOnline}>
              <Plus className="mr-2 h-4 w-4" /> New Ledger
            </Button>
          )}
        </div>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline — showing cached ledgers. Create and edit actions are disabled.
        </div>
      )}
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editItem ? 'Edit Ledger' : 'New Ledger'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="name" label="Ledger Name" error={errors.name?.message} {...register('name')} />
            <Input id="alias" label="Alias" {...register('alias')} />
          </div>

          <SlideSelect
            name="group_id"
            label="Under Group"
            placeholder="Select group..."
            panelTitle="Select Group"
            value={watch('group_id')}
            onChange={(val) => setValue('group_id', val, { shouldValidate: true })}
            error={errors.group_id?.message}
            queryKey={['accounting-groups-all']}
            queryFn={(params) => accountingGroupsApi.list({ ...params, per_page: '500' })}
            mapFn={(g: AccountingGroup) => ({ value: g.id, label: `${g.name}`})}
            displayValue={editItem?.group ? `${editItem.group.code} - ${editItem.group.name}` : undefined}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input id="opening_balance" label="Opening Balance" type="number" step="0.01" min="0" error={errors.opening_balance?.message} {...register('opening_balance')} />
            <SlideSelect
              name="opening_type"
              label="Dr / Cr"
              placeholder="Select..."
              panelTitle="Debit / Credit"
              options={[
                { value: 'dr', label: 'Debit (Dr)' },
                { value: 'cr', label: 'Credit (Cr)' },
              ]}
              value={watch('opening_type')}
              onChange={(val) => setValue('opening_type', val as 'dr' | 'cr', { shouldValidate: true })}
            />
            <Input id="opening_date" label="Opening Date" type="date" {...register('opening_date')} />
          </div>

          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Behavior Flags</h3>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" {...register('is_bill_wise')} />
                Bill-wise
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" {...register('is_cost_center_applicable')} />
                Cost Center
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" {...register('allow_manual_entry')} />
                Allow Manual Entry
              </label>
            </div>
          </div>

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
            placeholder="Search ledger..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Group Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Group
            </label>
            {groupFilter && (
              <button onClick={() => { setGroupFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <SlideSelect
            name="groupFilter"
            placeholder="All Groups"
            panelTitle="Filter by Group"
            value={groupFilter}
            onChange={(val) => { setGroupFilter(val); setPage(1); }}
            queryKey={['accounting-groups-all']}
            queryFn={(params) => accountingGroupsApi.list({ ...params, per_page: '500' })}
            mapFn={(g: AccountingGroup) => ({ value: g.id, label: `${g.name}` })}
          />
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setGroupFilter('');
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
