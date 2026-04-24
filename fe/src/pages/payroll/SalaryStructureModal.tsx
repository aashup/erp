import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, salaryComponentDefinitionsApi } from '@/api/payroll';
import type { Employee } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  effective_from:    z.string().min(1, 'Effective date is required'),
  basic:             z.coerce.number().min(0),
  hra:               z.coerce.number().min(0).default(0),
  da:                z.coerce.number().min(0).default(0),
  conveyance:        z.coerce.number().min(0).default(0),
  medical:           z.coerce.number().min(0).default(0),
  special_allowance: z.coerce.number().min(0).default(0),
  professional_tax:  z.coerce.number().min(0).default(0),
  tds_amount:        z.coerce.number().min(0).default(0),
});
type SalaryForm = z.infer<typeof schema>;

interface Props {
  employee: Employee;
  open: boolean;
  onClose: () => void;
}

export function SalaryStructureModal({ employee, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  const { data: structureRes, isLoading: structureLoading } = useQuery({
    queryKey: ['salary-structure', employee.id],
    queryFn: () => employeesApi.getSalaryStructure(employee.id),
    enabled: open,
    select: (res) => res.data.data,
  });

  const { data: definitions = [] } = useQuery({
    queryKey: ['salary-component-definitions'],
    queryFn: () => salaryComponentDefinitionsApi.list({ active_only: 'true' }),
    enabled: open,
    select: (res) => res.data.data ?? [],
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SalaryForm>({
    resolver: zodResolver(schema) as Resolver<SalaryForm>,
  });

  useEffect(() => {
    if (open) {
      const s = structureRes;
      reset({
        effective_from:    s?.effective_from ?? new Date().toISOString().slice(0, 10),
        basic:             s ? Number(s.basic) : 0,
        hra:               s ? Number(s.hra) : 0,
        da:                s ? Number(s.da) : 0,
        conveyance:        s ? Number(s.conveyance) : 0,
        medical:           s ? Number(s.medical) : 0,
        special_allowance: s ? Number(s.special_allowance) : 0,
        professional_tax:  s ? Number(s.professional_tax) : 0,
        tds_amount:        s ? Number(s.tds_amount) : 0,
      });
      // Populate custom component amounts from saved structure
      const map: Record<string, number> = {};
      (s?.custom_components ?? []).forEach((c) => {
        map[c.definition_id] = Number(c.amount);
      });
      setCustomAmounts(map);
    }
  }, [open, structureRes, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: SalaryForm) => {
      const custom_components = definitions
        .filter((d) => (customAmounts[d.id] ?? 0) > 0)
        .map((d) => ({
          definition_id: d.id,
          name: d.name,
          type: d.type,
          amount: customAmounts[d.id],
        }));
      return employeesApi.createSalaryStructure(employee.id, {
        ...data,
        custom_components: custom_components.length ? custom_components : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-structure', employee.id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
  });

  const basic   = watch('basic') || 0;
  const hra     = watch('hra') || 0;
  const da      = watch('da') || 0;
  const conv    = watch('conveyance') || 0;
  const med     = watch('medical') || 0;
  const special = watch('special_allowance') || 0;

  const customEarningSum = definitions
    .filter((d) => d.type === 'earning')
    .reduce((sum, d) => sum + (customAmounts[d.id] ?? 0), 0);

  const gross = Number(basic) + Number(hra) + Number(da) + Number(conv) + Number(med) + Number(special) + customEarningSum;

  const earningDefs   = definitions.filter((d) => d.type === 'earning');
  const deductionDefs = definitions.filter((d) => d.type === 'deduction');

  if (structureLoading) {
    return (
      <Modal open={open} onClose={onClose} title={`Salary Structure — ${employee.name}`} size="lg">
        <div className="space-y-4 animate-pulse">
          <div className="h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-2 h-4 w-20 rounded bg-blue-200 dark:bg-blue-700" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded bg-blue-100 dark:bg-blue-800" />)}
            </div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
            <div className="mb-2 h-4 w-28 rounded bg-orange-200 dark:bg-orange-700" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded bg-orange-100 dark:bg-orange-800" />)}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Salary Structure — ${employee.name}`} size="lg">
      <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
        <Input id="effective_from" label="Effective From" type="date" error={errors.effective_from?.message} {...register('effective_from')} />

        {/* Earnings */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="mb-2 text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Earnings</p>
          <div className="grid grid-cols-2 gap-3">
            <Input id="basic" label="Basic Salary (₹)" type="number" step="0.01" error={errors.basic?.message} {...register('basic')} />
            <Input id="hra" label="HRA (₹)" type="number" step="0.01" {...register('hra')} />
            <Input id="da" label="DA (₹)" type="number" step="0.01" {...register('da')} />
            <Input id="conveyance" label="Conveyance (₹)" type="number" step="0.01" {...register('conveyance')} />
            <Input id="medical" label="Medical (₹)" type="number" step="0.01" {...register('medical')} />
            <Input id="special_allowance" label="Special Allowance (₹)" type="number" step="0.01" {...register('special_allowance')} />
            {earningDefs.map((def) => (
              <Input
                key={def.id}
                id={`custom_earning_${def.id}`}
                label={`${def.name} (₹)`}
                type="number"
                step="0.01"
                value={customAmounts[def.id] ?? 0}
                onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [def.id]: Number(e.target.value) }))}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 dark:border-blue-700">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Gross Salary</span>
            <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
              ₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Deductions */}
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
          <p className="mb-2 text-xs font-semibold uppercase text-orange-700 dark:text-orange-300">
            Fixed Deductions (monthly)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input id="professional_tax" label="Professional Tax (₹)" type="number" step="0.01" {...register('professional_tax')} />
            <Input id="tds_amount" label="TDS (₹)" type="number" step="0.01" {...register('tds_amount')} />
            {deductionDefs.map((def) => (
              <Input
                key={def.id}
                id={`custom_deduction_${def.id}`}
                label={`${def.name} (₹)`}
                type="number"
                step="0.01"
                value={customAmounts[def.id] ?? 0}
                onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [def.id]: Number(e.target.value) }))}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
            PF (12% basic) and ESI (0.75% gross if ≤₹21,000) are calculated automatically each payroll run.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saveMutation.isPending}>Save Structure</Button>
        </div>
      </form>
    </Modal>
  );
}
