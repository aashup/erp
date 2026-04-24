import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { salaryComponentDefinitionsApi } from '@/api/payroll';
import type { SalaryComponentDefinition } from '@/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['earning', 'deduction']),
});
type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'earning', label: 'Earning' },
  { value: 'deduction', label: 'Deduction' },
];

export default function PayrollSettings() {
  usePageTitle('Payroll Settings');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('payroll.create');
  const canEdit   = hasPermission('payroll.edit');
  const canDelete = hasPermission('payroll.delete');

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState<SalaryComponentDefinition | null>(null);

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ['salary-component-definitions'],
    queryFn: () => salaryComponentDefinitionsApi.list(),
    select: (res) => res.data.data ?? [],
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => salaryComponentDefinitionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-component-definitions'] });
      setShowModal(false);
      toast.success('Component header added');
    },
    onError: () => toast.error('Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      salaryComponentDefinitionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-component-definitions'] });
      setShowModal(false);
      toast.success('Component header updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      salaryComponentDefinitionsApi.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary-component-definitions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryComponentDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-component-definitions'] });
      toast.success('Component header deleted');
    },
  });

  const openCreate = () => {
    setEditItem(null);
    reset({ name: '', type: 'earning' });
    setShowModal(true);
  };

  const openEdit = (item: SalaryComponentDefinition) => {
    setEditItem(item);
    reset({ name: item.name, type: item.type });
    setShowModal(true);
  };

  const onSubmit = (data: FormData) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const earnings   = definitions.filter((d) => d.type === 'earning');
  const deductions = definitions.filter((d) => d.type === 'deduction');

  const renderSection = (
    title: string,
    items: SalaryComponentDefinition[],
    colorClass: string,
    headerColorClass: string,
  ) => (
    <Card>
      <CardHeader>
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${colorClass}`}>
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${headerColorClass}`}>{title}</h3>
          <span className={`text-xs ${headerColorClass} opacity-75`}>{items.length} header{items.length !== 1 ? 's' : ''}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No {title.toLowerCase()} headers defined yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.name}</span>
                  <Badge variant={item.is_active ? 'success' : 'default'}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })}
                      className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={item.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {item.is_active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => openEdit(item)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => { if (confirm(`Delete "${item.name}"? This won't affect existing payslips.`)) deleteMutation.mutate(item.id); }}
                      className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payroll Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Define custom salary component headers. These appear in the salary structure form and on payslips.
            Renaming or deleting a header does not affect already-generated payslips.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Header
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {renderSection('Earning Headers', earnings, 'bg-blue-50 dark:bg-blue-900/20', 'text-blue-700 dark:text-blue-300')}
        {renderSection('Deduction Headers', deductions, 'bg-orange-50 dark:bg-orange-900/20', 'text-orange-700 dark:text-orange-300')}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Component Header' : 'Add Component Header'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name" label="Header Name *" placeholder="e.g. Transport Allowance" error={errors.name?.message} {...register('name')} />
          <SlideSelect
            name="type"
            label="Type"
            options={TYPE_OPTIONS}
            value={watch('type') ?? 'earning'}
            onChange={(v) => setValue('type', v as 'earning' | 'deduction')}
          />
          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editItem ? 'Update' : 'Add Header'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
