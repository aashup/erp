import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { financialYearsApi, documentCountersApi } from '@/api/financialYears';
import type { FinancialYear, DocumentCounter } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, Star, Lock, Unlock, ArrowUp, ArrowDown, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  label: z.string().min(1, 'Label is required (e.g. 2024-25)'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_current: z.boolean().optional(),
});

type FYForm = z.infer<typeof schema>;

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const DOC_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  sales_order: 'Sales Order',
  purchase_invoice: 'Purchase Invoice',
  sales_invoice: 'Sales Invoice',
  contra: 'Contra',
  payment: 'Payment',
  receipt: 'Receipt',
  journal: 'Journal',
  purchase: 'Purchase',
  sales: 'Sales',
  payroll: 'Payroll',
};

const DOC_TYPE_ORDER = [
  'sales_invoice', 'purchase_invoice', 'sales_order', 'purchase_order',
  'receipt', 'payment', 'journal', 'contra', 'purchase', 'sales', 'payroll',
];

export default function FinancialYears() {
  usePageTitle('Financial Years');
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editFY, setEditFY] = useState<FinancialYear | null>(null);
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Document Counters modal state
  const [countersFY, setCountersFY] = useState<FinancialYear | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { prefix: string; next_number: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['financial-years', sortBy, sortOrder],
    queryFn: () => financialYearsApi.list({ per_page: '50', sort_by: sortBy, sort_order: sortOrder }),
    select: (res) => res.data,
  });

  const { data: countersData, isLoading: countersLoading } = useQuery({
    queryKey: ['document-counters', countersFY?.id],
    queryFn: () => documentCountersApi.list(countersFY!.id),
    enabled: !!countersFY,
    select: (res) => res.data,
  });

  // Initialize drafts when counters load
  useEffect(() => {
    if (!countersData?.data) return;
    const initial: Record<string, { prefix: string; next_number: string }> = {};
    for (const c of countersData.data) {
      initial[c.id] = { prefix: c.prefix ?? '', next_number: String(c.next_number) };
    }
    setDrafts(initial);
  }, [countersData?.data]);

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

  const updateCounterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { prefix: string | null; next_number: number } }) =>
      documentCountersApi.update(id, data),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update counter'),
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

  const closeCountersModal = () => {
    setCountersFY(null);
    setDrafts({});
  };

  const handleSaveCounters = async () => {
    if (!countersData?.data) return;

    const changed = countersData.data.filter((c) => {
      const draft = drafts[c.id];
      if (!draft) return false;
      return draft.prefix !== (c.prefix ?? '') || draft.next_number !== String(c.next_number);
    });

    if (changed.length === 0) {
      toast('No changes to save.');
      return;
    }

    try {
      await Promise.all(
        changed.map((c) =>
          documentCountersApi.update(c.id, {
            prefix: drafts[c.id].prefix || null,
            next_number: parseInt(drafts[c.id].next_number, 10) || 1,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['document-counters', countersFY?.id] });
      toast.success('Document counters saved');
    } catch {
      // individual errors handled by the API
    }
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

  // Sort counters by preferred order for display
  const sortedCounters = (countersData?.data ?? []).slice().sort((a, b) => {
    const ai = DOC_TYPE_ORDER.indexOf(a.document_type);
    const bi = DOC_TYPE_ORDER.indexOf(b.document_type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const columns: ColumnDef<FinancialYear, unknown>[] = [
    {
      id: 'label',
      accessorKey: 'label',
      header: () => (
        <button onClick={() => handleSort('label')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Financial Year {renderSortIcon('label')}
        </button>
      ),
    },
    {
      id: 'start_date',
      accessorKey: 'start_date',
      header: () => (
        <button onClick={() => handleSort('start_date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Start Date {renderSortIcon('start_date')}
        </button>
      ),
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      id: 'end_date',
      accessorKey: 'end_date',
      header: () => (
        <button onClick={() => handleSort('end_date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          End Date {renderSortIcon('end_date')}
        </button>
      ),
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      id: 'is_current',
      accessorKey: 'is_current',
      header: () => (
        <button onClick={() => handleSort('is_current')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
          Default {renderSortIcon('is_current')}
        </button>
      ),
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
            onClick={() => setCountersFY(row.original)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Document Counters"
          >
            <Hash className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </button>
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
            Use the <Hash className="inline h-3.5 w-3.5 text-blue-500" /> icon to configure document numbering counters per year.
          </p>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      {/* FY Create/Edit Modal */}
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

      {/* Document Counters Modal */}
      <Modal
        open={!!countersFY}
        onClose={closeCountersModal}
        title={`Document Counters — ${countersFY?.label ?? ''}`}
        size="lg"
      >
        {countersData?.is_locked && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <Lock className="h-4 w-4 shrink-0" />
            <span>Read-only: transactions have been recorded in this financial year.</span>
          </div>
        )}

        {countersLoading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading counters…</div>
        ) : sortedCounters.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No counters found. They are created automatically when you add a new financial year.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Document Type</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Prefix</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Next Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedCounters.map((counter: DocumentCounter) => (
                    <tr key={counter.id} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                        {DOC_TYPE_LABELS[counter.document_type] ?? counter.document_type}
                      </td>
                      <td className="px-4 py-2.5">
                        {countersData?.is_locked ? (
                          <span className="text-gray-600 dark:text-gray-400">{counter.prefix || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            value={drafts[counter.id]?.prefix ?? ''}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [counter.id]: { ...prev[counter.id], prefix: e.target.value },
                              }))
                            }
                            placeholder="e.g. INV-"
                            className="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {countersData?.is_locked ? (
                          <span className="text-gray-600 dark:text-gray-400">{counter.next_number}</span>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            value={drafts[counter.id]?.next_number ?? '1'}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [counter.id]: { ...prev[counter.id], next_number: e.target.value },
                              }))
                            }
                            className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!countersData?.is_locked && (
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={closeCountersModal}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCounters} loading={updateCounterMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
