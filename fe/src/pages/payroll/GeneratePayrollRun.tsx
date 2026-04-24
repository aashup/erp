import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { employeesApi, payrollApi } from '@/api/payroll';
import type { Employee } from '@/types';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export default function GeneratePayrollRun() {
  usePageTitle('Generate Payroll Run');
  const navigate = useNavigate();
  const today = new Date();

  const [month, setMonth]             = useState(today.getMonth() + 1);
  const [year, setYear]               = useState(today.getFullYear());
  const [workingDays, setWorkingDays] = useState(26);
  const [notes, setNotes]             = useState('');

  // per-employee present days overrides (keyed by employee.id)
  const [presentDays, setPresentDays] = useState<Record<string, number>>({});
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays]       = useState<string>('');

  // fetch all active employees
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeesApi.list({ per_page: '500' }),
    select: (res) => (res.data.data ?? []) as Employee[],
  });

  // whenever workingDays changes, reset all present days to new working days
  useEffect(() => {
    setPresentDays((prev) => {
      const next: Record<string, number> = {};
      employees.forEach((e) => {
        next[e.id] = prev[e.id] !== undefined ? Math.min(prev[e.id], workingDays) : workingDays;
      });
      return next;
    });
  }, [workingDays, employees]);

  // initialise present days once employees load
  useEffect(() => {
    setPresentDays((prev) => {
      const next: Record<string, number> = { ...prev };
      employees.forEach((e) => {
        if (next[e.id] === undefined) next[e.id] = workingDays;
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // 1. generate run
      const res = await payrollApi.generate({ month, year, working_days: workingDays, notes: notes || undefined });
      const run = res.data.data;

      // 2. fetch run detail to get entry IDs
      const detailRes = await payrollApi.get(run.id);
      const entries = detailRes.data.data?.entries ?? [];

      // 3. update entries where present_days differs from workingDays
      const patches = entries.filter((entry) => {
        const override = presentDays[entry.employee_id];
        return override !== undefined && override !== workingDays;
      });

      await Promise.all(
        patches.map((entry) =>
          payrollApi.updateEntry(run.id, entry.id, presentDays[entry.employee_id])
        )
      );

      return run.id;
    },
    onSuccess: (runId) => {
      toast.success('Payroll run generated');
      navigate(`/payroll/runs/${runId}`);
    },
    onError: () => toast.error('Failed to generate payroll run'),
  });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const allSelected = employees.length > 0 && employees.every((e) => selected.has(e.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(employees.map((e) => e.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyBulk = () => {
    const val = Number(bulkDays);
    if (!bulkDays || isNaN(val) || val < 0) return;
    const clamped = Math.min(val, workingDays);
    setPresentDays((prev) => {
      const next = { ...prev };
      selected.forEach((id) => { next[id] = clamped; });
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/payroll/runs')}
          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Generate Payroll Run</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Set the period, working days, and present days per employee before generating.
          </p>
        </div>
      </div>

      {/* Run parameters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Run Parameters</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2020}
              max={2100}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Working Days</label>
            <input
              type="number"
              value={workingDays}
              onChange={(e) => setWorkingDays(Number(e.target.value))}
              min={1}
              max={31}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. April 2026"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Employee present-days table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-xl border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            Select All
          </label>

          {someSelected && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selected.size} selected — set present days:
              </span>
              <input
                type="number"
                value={bulkDays}
                onChange={(e) => setBulkDays(e.target.value)}
                min={0}
                max={workingDays}
                placeholder={String(workingDays)}
                className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={applyBulk}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}

          <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Users className="h-3.5 w-3.5" />
            {employees.length} employees
          </span>
        </div>

        {/* Table */}
        {empLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No employees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="w-10 px-4 py-2.5"></th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Employee</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Department</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Designation</th>
                  <th className="w-40 px-4 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">
                    Present / {workingDays} days
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {employees.map((emp) => {
                  const days = presentDays[emp.id] ?? workingDays;
                  const isSelected = selected.has(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(emp.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{emp.name}</div>
                        {emp.employee_code && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{emp.employee_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {(emp as Employee & { department?: { name: string } }).department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {(emp as Employee & { designation?: { name: string } }).designation?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={workingDays}
                            value={days}
                            onChange={(e) =>
                              setPresentDays((prev) => ({
                                ...prev,
                                [emp.id]: Math.min(Math.max(0, Number(e.target.value)), workingDays),
                              }))
                            }
                            className={`w-16 rounded border px-2 py-1 text-center text-sm ${
                              days < workingDays
                                ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
                                : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            }`}
                          />
                          <span className="text-xs text-gray-400">/ {workingDays}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Only employees with active salary structures will be included in the run.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/payroll/runs')}>
            Cancel
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            disabled={generateMutation.isPending}
          >
            Generate Run
          </Button>
        </div>
      </div>
    </div>
  );
}
