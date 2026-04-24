import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { payrollApi } from '@/api/payroll';
import type { PayrollEntry } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle, CreditCard, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/axios';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const statusVariant: Record<string, 'warning' | 'info' | 'success'> = {
  draft: 'warning',
  approved: 'info',
  paid: 'success',
};

export default function PayrollRunDetail() {
  usePageTitle('Payroll Run Detail');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit   = hasPermission('payroll.edit');

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () => payrollApi.get(id!),
    select: (res) => res.data.data,
  });

  const approveMutation = useMutation({
    mutationFn: () => payrollApi.approve(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => payrollApi.markPaid(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, presentDays }: { entryId: string; presentDays: number }) =>
      payrollApi.updateEntry(id!, entryId, presentDays),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDays, setEditDays] = useState<Record<string, number>>({});

  const handleDayChange = (entryId: string, days: number) => {
    setEditDays((prev) => ({ ...prev, [entryId]: days }));
  };

  const saveEntryDays = (entry: PayrollEntry) => {
    const days = editDays[entry.id] ?? entry.present_days;
    updateEntryMutation.mutate({ entryId: entry.id, presentDays: days });
    setEditingEntry(null);
  };

  const downloadPayslip = async (entry: PayrollEntry) => {
    const token = localStorage.getItem('token');
    const url = payrollApi.payslipUrl(id!, entry.employee_id);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Payslip-${entry.employee?.name ?? entry.employee_id}.pdf`;
    a.click();
  };

  if (isLoading || !data) {
    return <div className="p-8 text-center text-gray-500">Loading payroll run...</div>;
  }

  const run = data;
  const isDraft    = run.status === 'draft';
  const isApproved = run.status === 'approved';
  const period     = `${MONTHS[run.month - 1]} ${run.year}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/payroll/runs')} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payroll — {period}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Badge variant={statusVariant[run.status]}>{run.status.charAt(0).toUpperCase() + run.status.slice(1)}</Badge>
              <span>{run.working_days} working days</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && canEdit && (
            <Button onClick={() => { if (confirm('Approve payroll and post journal entry?')) approveMutation.mutate(); }} loading={approveMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve & Post
            </Button>
          )}
          {isApproved && canEdit && (
            <Button variant="secondary" onClick={() => { if (confirm('Mark payroll as paid?')) markPaidMutation.mutate(); }} loading={markPaidMutation.isPending}>
              <CreditCard className="mr-2 h-4 w-4" />
              Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Gross Salary', value: formatCurrency(run.total_gross), color: 'blue' },
          { label: 'Total Deductions', value: formatCurrency(run.total_deductions), color: 'orange' },
          { label: 'Net Payable', value: formatCurrency(run.total_net), color: 'green' },
          { label: 'Employer PF + ESI', value: formatCurrency(Number(run.total_pf_employer) + Number(run.total_esi_employer)), color: 'purple' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className={`mt-1 text-xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee-wise Breakdown</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Employee', 'Present / Working', 'Gross', 'PF (Emp)', 'ESI (Emp)', 'PT', 'TDS', 'Deductions', 'Net Salary', ''].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {(run.entries ?? []).map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.employee?.name ?? '—'}
                    <div className="text-xs text-gray-400">{entry.employee?.designation?.name}</div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {isDraft && editingEntry === entry.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={run.working_days}
                          value={editDays[entry.id] ?? entry.present_days}
                          onChange={(e) => handleDayChange(entry.id, Number(e.target.value))}
                          className="w-14 rounded border border-gray-300 px-1 py-0.5 text-center text-sm dark:border-gray-600 dark:bg-gray-700"
                        />
                        <span className="text-gray-400">/ {run.working_days}</span>
                        <button
                          onClick={() => saveEntryDays(entry)}
                          className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        className={isDraft ? 'cursor-pointer underline-offset-2 hover:underline' : ''}
                        onClick={() => { if (isDraft) { setEditingEntry(entry.id); setEditDays((p) => ({ ...p, [entry.id]: entry.present_days })); } }}
                      >
                        {entry.present_days} / {run.working_days}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm">{formatCurrency(entry.gross_salary)}</td>
                  <td className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{formatCurrency(entry.pf_employee)}</td>
                  <td className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{formatCurrency(entry.esi_employee)}</td>
                  <td className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{formatCurrency(entry.professional_tax)}</td>
                  <td className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{formatCurrency(entry.tds)}</td>
                  <td className="px-3 py-3 text-sm font-medium text-red-700 dark:text-red-400">{formatCurrency(entry.total_deductions)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(entry.net_salary)}</td>
                  <td className="px-3 py-3 text-sm">
                    <button
                      onClick={() => downloadPayslip(entry)}
                      className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Download Payslip"
                    >
                      <Download className="h-4 w-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Journal Link */}
      {run.voucher_id && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          Journal entry posted successfully. Voucher ID: <span className="font-mono">{run.voucher_id}</span>
        </div>
      )}
    </div>
  );
}
