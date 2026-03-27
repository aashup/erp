import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { chartOfAccountsApi } from '@/api/accounting';
import type { ChartOfAccount } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  opening_balance: z.coerce.number().min(0, 'Cannot be negative').optional(),
  balance_type: z.enum(['dr', 'cr']).optional(),
});

type AccountForm = z.infer<typeof schema>;

const typeColor: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  asset: 'info', liability: 'danger', equity: 'success', income: 'success', expense: 'warning',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => chartOfAccountsApi.list({ per_page: '200' }),
    select: (res) => res.data,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountForm> }) => chartOfAccountsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chartOfAccountsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountForm>({ resolver: zodResolver(schema) });

  const openEdit = (account: ChartOfAccount) => {
    setEditAccount(account);
    reset({
      name: account.name,
      opening_balance: Number(account.opening_balance) || 0,
      balance_type: account.balance_type ?? 'dr',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditAccount(null);
    reset();
  };

  const onSubmit = (formData: AccountForm) => {
    if (editAccount) {
      updateMutation.mutate({ id: editAccount.id, data: formData });
    }
  };

  const columns: ColumnDef<ChartOfAccount, unknown>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => { const t = getValue() as string; return <Badge variant={typeColor[t]}>{t}</Badge>; } },
    {
      id: 'opening_balance',
      header: 'Opening Balance',
      cell: ({ row }) => {
        const bal = Number(row.original.opening_balance);
        if (bal === 0) return <span className="text-gray-400">—</span>;
        const type = row.original.balance_type === 'dr' ? 'Dr' : 'Cr';
        return (
          <span className={row.original.balance_type === 'dr' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}>
            {formatCurrency(bal)} {type}
          </span>
        );
      },
    },
    { accessorKey: 'is_system', header: 'System', cell: ({ getValue }) => getValue() ? <Badge variant="info">System</Badge> : '—' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
            {!row.original.is_system && (
              <button
                onClick={() => { if (confirm('Delete this account?')) deleteMutation.mutate(row.original.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chart of Accounts</h1>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Account groups are loaded from Settings. Edit accounts to set opening balances.</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>
      <Modal open={showModal} onClose={closeModal} title="Edit Account">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Read-only info */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Code</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{editAccount?.code}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd><Badge variant={typeColor[editAccount?.type ?? 'asset']}>{editAccount?.type}</Badge></dd>
              </div>
              {editAccount?.parent_id && (
                <div className="col-span-2">
                  <dt className="text-gray-500 dark:text-gray-400">Parent Group</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {(data?.data ?? []).find((a) => a.id === editAccount.parent_id)?.name ?? '—'}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <Input id="name" label="Account Name" error={errors.name?.message} {...register('name')} />

          {/* Opening Balance Section */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Opening Balance (Previous Year)</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="opening_balance"
                label="Amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                error={errors.opening_balance?.message}
                {...register('opening_balance')}
              />
              <Select
                id="balance_type"
                label="Dr / Cr"
                options={[
                  { value: 'dr', label: 'Debit (Dr)' },
                  { value: 'cr', label: 'Credit (Cr)' },
                ]}
                {...register('balance_type')}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Enter the closing balance from the previous financial year as the opening balance here.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
