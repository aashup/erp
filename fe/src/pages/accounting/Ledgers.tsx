import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ledgersApi, accountingGroupsApi } from '@/api/accounting';
import type { AccountingGroup, Ledger } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Ledger | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ledgers', page, search, groupFilter],
    queryFn: () => ledgersApi.list({ page: String(page), search, ...(groupFilter ? { group_id: groupFilter } : {}) }),
    select: (res) => res.data,
  });

  const { data: groupsData } = useQuery({
    queryKey: ['accounting-groups-all'],
    queryFn: () => accountingGroupsApi.list({ per_page: '500' }),
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

  const groupOptions = (groupsData?.data ?? []).map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` }));

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

  const columns: ColumnDef<Ledger, unknown>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        {row.original.alias && <span className="ml-2 text-xs text-gray-400">({row.original.alias})</span>}
      </div>
    )},
    { accessorKey: 'group', header: 'Group', cell: ({ row }) => (
      <span className="text-sm">{row.original.group?.name ?? '—'}</span>
    )},
    { accessorKey: 'opening_balance', header: 'Opening Balance', cell: ({ row }) => (
      <span className="text-sm">
        {row.original.opening_balance > 0
          ? `${formatCurrency(row.original.opening_balance)} ${row.original.opening_type.toUpperCase()}`
          : '—'}
      </span>
    )},
    { accessorKey: 'is_system', header: 'Type', cell: ({ getValue }) => (
      <Badge variant={getValue() ? 'info' : 'default'}>{getValue() ? 'System' : 'Manual'}</Badge>
    )},
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          {!row.original.is_system && (
            <button onClick={() => handleDelete(row.original)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ledgers</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Ledger</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Search ledger..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
              value={groupFilter}
              onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Groups</option>
              {groupOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        </CardHeader>
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
    </div>
  );
}
