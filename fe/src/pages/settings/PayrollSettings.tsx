import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { salaryComponentDefinitionsApi } from '@/api/payroll';
import { companySettingsApi } from '@/api/settings';
import type { SalaryComponentDefinition } from '@/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
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

const FIXED_EARNINGS: { key: string; label: string }[] = [
  { key: 'basic',             label: 'Basic Salary' },
  { key: 'hra',               label: 'HRA' },
  { key: 'da',                label: 'DA' },
  { key: 'conveyance',        label: 'Conveyance' },
  { key: 'medical',           label: 'Medical' },
  { key: 'special_allowance', label: 'Special Allowance' },
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

  // Distribution state: key → percentage (0–100)
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ['salary-component-definitions'],
    queryFn: () => salaryComponentDefinitionsApi.list(),
    select: (res) => res.data.data ?? [],
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  // Populate distribution state from saved settings
  useEffect(() => {
    const raw = (companySettings as Record<string, unknown>)?.salary_distribution_percentages;
    if (raw && typeof raw === 'string') {
      try { setDistribution(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [companySettings]);

  // ── Mutations ────────────────────────────────────────────────────────────────

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

  const saveDistributionMutation = useMutation({
    mutationFn: (dist: Record<string, number>) =>
      companySettingsApi.update({ salary_distribution_percentages: JSON.stringify(dist) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Salary distribution saved');
    },
    onError: () => toast.error('Failed to save distribution'),
  });

  // ── Header CRUD helpers ───────────────────────────────────────────────────────

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

  // ── Distribution helpers ──────────────────────────────────────────────────────

  const activeCustomEarnings = definitions.filter((d) => d.type === 'earning' && d.is_active);

  // All earning rows (fixed + active custom)
  const allEarningRows = [
    ...FIXED_EARNINGS,
    ...activeCustomEarnings.map((d) => ({ key: d.id, label: d.name })),
  ];

  const total = allEarningRows.reduce((sum, r) => sum + (distribution[r.key] ?? 0), 0);
  const totalRounded = Math.round(total * 100) / 100;
  const isValid = totalRounded === 100;

  const setPercent = (key: string, val: number) =>
    setDistribution((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, val)) }));

  const distributeEvenly = () => {
    const share = Math.floor((100 / allEarningRows.length) * 100) / 100;
    const newDist: Record<string, number> = {};
    allEarningRows.forEach((r, i) => {
      // last row absorbs rounding remainder
      newDist[r.key] = i === allEarningRows.length - 1
        ? Math.round((100 - share * (allEarningRows.length - 1)) * 100) / 100
        : share;
    });
    setDistribution(newDist);
  };

  // ── Sections ─────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payroll Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Define custom salary component headers and configure how gross salary is distributed.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Header
          </Button>
        )}
      </div>

      {/* Component Headers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {renderSection('Earning Headers', earnings, 'bg-blue-50 dark:bg-blue-900/20', 'text-blue-700 dark:text-blue-300')}
        {renderSection('Deduction Headers', deductions, 'bg-orange-50 dark:bg-orange-900/20', 'text-orange-700 dark:text-orange-300')}
      </div>

      {/* Salary Distribution Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Salary Distribution</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={distributeEvenly}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Distribute evenly
              </button>
              <Button
                size="sm"
                disabled={!isValid || saveDistributionMutation.isPending}
                loading={saveDistributionMutation.isPending}
                onClick={() => saveDistributionMutation.mutate(distribution)}
              >
                Save
              </Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set the % split for each earning component. When you enter a total salary in the Salary Structure form, amounts are filled automatically. Total must equal 100%.
          </p>
        </CardHeader>
        <CardContent>
          {allEarningRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No earning components available.</p>
          ) : (
            <div className="space-y-1">
              {allEarningRows.map((row) => (
                <div key={row.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <span className="w-44 truncate text-sm text-gray-700 dark:text-gray-300">{row.label}</span>
                  <div className="relative flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${Math.min(distribution[row.key] ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={distribution[row.key] ?? 0}
                      onChange={(e) => setPercent(row.key, Number(e.target.value))}
                      className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              ))}

              {/* Total row */}
              <div className={`mt-2 flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                isValid
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}>
                <span className={`text-sm font-semibold ${isValid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  Total
                </span>
                <span className={`text-sm font-bold ${isValid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {totalRounded}% {isValid ? '✓' : `— needs ${(100 - totalRounded).toFixed(2)}% more`}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header CRUD Modal */}
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
