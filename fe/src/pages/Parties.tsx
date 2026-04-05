import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { partiesApi } from '@/api/parties';
import type { Party } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const schema = z.object({
  type: z.enum(['customer', 'vendor', 'both']),
  name: z.string().min(1, 'Name is required'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
  pincode: z.string().optional(),
  contact_person: z.string().optional(),
  credit_limit: z.coerce.number().min(0).optional(),
  opening_balance: z.coerce.number().optional(),
  balance_type: z.enum(['dr', 'cr']).optional(),
  is_active: z.boolean().optional(),
});

type PartyForm = z.infer<typeof schema>;

export default function Parties() {
  usePageTitle('Parties');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['parties', page, search, typeFilter, sortBy, sortOrder],
    queryFn: () => partiesApi.list({ page: String(page), search, sort_by: sortBy, sort_order: sortOrder, ...(typeFilter ? { type: typeFilter } : {}) }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: PartyForm) => partiesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['parties'] }); queryClient.invalidateQueries({ queryKey: ['ledgers'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PartyForm> }) => partiesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['parties'] }); queryClient.invalidateQueries({ queryKey: ['ledgers'] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => partiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties'] }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PartyForm>({ resolver: zodResolver(schema) as any });

  const openCreate = () => { setEditParty(null); reset({ type: 'customer', name: '', opening_balance: undefined, balance_type: undefined, is_active: true }); setShowModal(true); };
  const openEdit = (p: Party) => {
    setEditParty(p);
    reset({ type: p.type, name: p.name, gstin: p.gstin ?? '', pan: p.pan ?? '', phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '', city: p.city ?? '', state: p.state ?? '', state_code: p.state_code ?? '', pincode: p.pincode ?? '', contact_person: p.contact_person ?? '', credit_limit: p.credit_limit ?? undefined, is_active: p.is_active });
    setShowModal(true);
  };

  const onSubmit = (formData: PartyForm) => {
    if (editParty) updateMutation.mutate({ id: editParty.id, data: formData });
    else createMutation.mutate(formData);
  };

  const typeColor: Record<string, 'info' | 'success' | 'warning'> = { customer: 'info', vendor: 'success', both: 'warning' };

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

  const columns: ColumnDef<Party, unknown>[] = [
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
      id: 'type',
      header: () => (
        <button
          onClick={() => handleSort('type')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by type"
        >
          Type
          {renderSortIcon('type')}
        </button>
      ),
      cell: ({ row }) => <Badge variant={typeColor[row.original.type]}>{row.original.type}</Badge>,
    },
    {
      id: 'gstin',
      header: () => (
        <button
          onClick={() => handleSort('gstin')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by GSTIN"
        >
          GSTIN
          {renderSortIcon('gstin')}
        </button>
      ),
      accessorKey: 'gstin',
    },
    {
      id: 'city',
      header: () => (
        <button
          onClick={() => handleSort('city')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by city"
        >
          City
          {renderSortIcon('city')}
        </button>
      ),
      accessorKey: 'city',
    },
    {
      id: 'phone',
      header: () => (
        <button
          onClick={() => handleSort('phone')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by phone"
        >
          Phone
          {renderSortIcon('phone')}
        </button>
      ),
      accessorKey: 'phone',
    },
    {
      id: 'credit_limit',
      header: () => (
        <button
          onClick={() => handleSort('credit_limit')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by credit limit"
        >
          Credit Limit
          {renderSortIcon('credit_limit')}
        </button>
      ),
      cell: ({ row }) => {
        const v = row.original.credit_limit;
        return v ? formatCurrency(v) : '—';
      },
    },
    {
      id: 'actions', header: '',
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Parties</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Party</Button>
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editParty ? 'Edit Party' : 'New Party'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SlideSelect name="type" label="Type" placeholder="Select type" panelTitle="Select Type" options={[{ value: 'customer', label: 'Customer' }, { value: 'vendor', label: 'Vendor' }, { value: 'both', label: 'Both' }]} value={watch('type')} onChange={(val) => setValue('type', val as 'customer' | 'vendor' | 'both', { shouldValidate: true })} error={errors.type?.message} />
            <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
            <Input id="gstin" label="GSTIN" {...register('gstin')} />
            <Input id="pan" label="PAN" {...register('pan')} />
            <Input id="phone" label="Phone" {...register('phone')} />
            <Input id="email" label="Email" {...register('email')} />
            <Input id="address" label="Address" {...register('address')} />
            <Input id="city" label="City" {...register('city')} />
            <Input id="state" label="State" {...register('state')} />
            <Input id="state_code" label="State Code" {...register('state_code')} />
            <Input id="pincode" label="Pincode" {...register('pincode')} />
            <Input id="contact_person" label="Contact Person" {...register('contact_person')} />
            <Input id="credit_limit" label="Credit Limit" type="number" step="0.01" {...register('credit_limit')} />
            {!editParty && (
              <>
                <Input id="opening_balance" label="Opening Balance" type="number" step="0.01" {...register('opening_balance')} />
                <SlideSelect name="balance_type" label="Balance Type" placeholder="Select..." panelTitle="Balance Type" options={[{ value: '', label: 'Select...' }, { value: 'dr', label: 'Debit (Dr)' }, { value: 'cr', label: 'Credit (Cr)' }]} value={watch('balance_type') ?? ''} onChange={(val) => setValue('balance_type', (val === '' ? undefined : val) as 'dr' | 'cr' | undefined)} />
              </>
            )}
            {editParty && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" {...register('is_active')} />
                Active
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editParty ? 'Update' : 'Create'}</Button>
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
            placeholder="Search party..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Type Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Type
            </label>
            {typeFilter && (
              <button onClick={() => { setTypeFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All types</option>
            <option value="customer">Customers</option>
            <option value="vendor">Vendors</option>
            <option value="both">Both</option>
          </select>
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setTypeFilter('');
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
