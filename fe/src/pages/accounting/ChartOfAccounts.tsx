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
import { Plus } from 'lucide-react';

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  group: z.string().optional(),
});

type AccountForm = z.infer<typeof schema>;

const typeColor: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  asset: 'info', liability: 'danger', equity: 'success', income: 'success', expense: 'warning',
};

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => chartOfAccountsApi.list({ per_page: '100' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: AccountForm) => chartOfAccountsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); setShowModal(false); },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountForm>({ resolver: zodResolver(schema) });

  const openCreate = () => { reset({ code: '', name: '', type: 'asset', group: '' }); setShowModal(true); };

  const columns: ColumnDef<ChartOfAccount, unknown>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => { const t = getValue() as string; return <Badge variant={typeColor[t]}>{t}</Badge>; } },
    { accessorKey: 'group', header: 'Group' },
    { accessorKey: 'is_system', header: 'System', cell: ({ getValue }) => getValue() ? <Badge variant="info">System</Badge> : '—' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500">Double-entry accounting chart</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Account">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input id="code" label="Account Code" error={errors.code?.message} {...register('code')} />
          <Input id="name" label="Account Name" error={errors.name?.message} {...register('name')} />
          <Select id="type" label="Type" options={[{ value: 'asset', label: 'Asset' }, { value: 'liability', label: 'Liability' }, { value: 'equity', label: 'Equity' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} error={errors.type?.message} {...register('type')} />
          <Input id="group" label="Group" {...register('group')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
