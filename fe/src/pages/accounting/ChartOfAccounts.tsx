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
import { Plus, Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  group: z.string().optional(),
  parent_id: z.string().optional(),
});

type AccountForm = z.infer<typeof schema>;

const typeColor: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  asset: 'info', liability: 'danger', equity: 'success', income: 'success', expense: 'warning',
};

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => chartOfAccountsApi.list({ per_page: '200' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: AccountForm) => chartOfAccountsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); closeModal(); },
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

  const openCreate = () => {
    setEditAccount(null);
    reset({ code: '', name: '', type: 'asset', group: '', parent_id: '' });
    setShowModal(true);
  };

  const openEdit = (account: ChartOfAccount) => {
    setEditAccount(account);
    reset({
      code: account.code,
      name: account.name,
      type: account.type,
      group: account.group ?? '',
      parent_id: account.parent_id ?? '',
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
    } else {
      createMutation.mutate(formData);
    }
  };

  const parentOptions = (data?.data ?? []).map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }));

  const columns: ColumnDef<ChartOfAccount, unknown>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => { const t = getValue() as string; return <Badge variant={typeColor[t]}>{t}</Badge>; } },
    { accessorKey: 'group', header: 'Group' },
    { accessorKey: 'is_system', header: 'System', cell: ({ getValue }) => getValue() ? <Badge variant="info">System</Badge> : '—' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.is_system) return null;
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => { if (confirm('Delete this account?')) deleteMutation.mutate(row.original.id); }}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chart of Accounts</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Double-entry accounting chart</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>
      <Modal open={showModal} onClose={closeModal} title={editAccount ? 'Edit Account' : 'New Account'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="code" label="Account Code" error={errors.code?.message} {...register('code')} />
          <Input id="name" label="Account Name" error={errors.name?.message} {...register('name')} />
          <Select id="type" label="Type" options={[{ value: 'asset', label: 'Asset' }, { value: 'liability', label: 'Liability' }, { value: 'equity', label: 'Equity' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} error={errors.type?.message} {...register('type')} />
          <Input id="group" label="Group" {...register('group')} />
          <Select id="parent_id" label="Parent Account (optional)" options={[{ value: '', label: 'None' }, ...parentOptions]} {...register('parent_id')} />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editAccount ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
