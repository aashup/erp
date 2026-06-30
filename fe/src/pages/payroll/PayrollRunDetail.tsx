import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { payrollApi } from '@/api/payroll';
import { ledgersApi } from '@/api/accounting';
import type { PayrollEntry } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle, CreditCard, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const statusVariant: Record<string, 'warning' | 'info' | 'success'> = {
  draft: 'warning',
  approved: 'info',
  paid: 'success',
};

function PaymentVouchersSummary({ entries }: { entries: PayrollEntry[] }) {
  const grouped: Record<string, { voucherNumber: string; employees: string[]; total: number }> = {};
  for (const e of entries) {
    if (!e.is_paid || !e.payment_voucher) continue;
    const vnum = e.payment_voucher.voucher_number;
    if (!grouped[vnum]) grouped[vnum] = { voucherNumber: vnum, employees: [], total: 0 };
    grouped[vnum].employees.push(e.employee?.name ?? '—');
    grouped[vnum].total += Number(e.net_salary);
  }
  const rows = Object.values(grouped);
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Vouchers</p>
      </CardHeader>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((row) => (
          <div key={row.voucherNumber} className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{row.voucherNumber}</span>
              <span className="ml-3 text-sm text-gray-500">{row.employees.join(', ')}</span>
            </div>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(row.total)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PayrollRunDetail() {
  usePageTitle('Payroll Run Detail');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('payroll.edit');

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [paymentLedgerId, setPaymentLedgerId] = useState<string>('');
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const { data: cashBankLedgers } = useQuery({
    queryKey: ['cash-bank-ledgers'],
    queryFn: () => ledgersApi.list({ group_system_key: 'cash_account,bank_account', per_page: '100' }),
    select: (res) => res.data.data,
  });

  useEffect(() => {
    if (cashBankLedgers && cashBankLedgers.length > 0 && !paymentLedgerId) {
      setPaymentLedgerId(cashBankLedgers[0].id);
    }
  }, [cashBankLedgers]);

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
    mutationFn: (payload: { entry_ids: string[]; payment_ledger_id: string }) =>
      payrollApi.markPaid(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSelectedEntryIds(new Set());
    },
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

  const unpaidEntries = (run.entries ?? []).filter((e) => !e.is_paid);
  const allSelected   = unpaidEntries.length > 0 && selectedEntryIds.size === unpaidEntries.length;
  const someSelected  = selectedEntryIds.size > 0 && selectedEntryIds.size < unpaidEntries.length;

  // Sync indeterminate state on the select-all checkbox
  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected;
  }

  const selectedNetTotal = (run.entries ?? [])
    .filter((e) => selectedEntryIds.has(e.id))
    .reduce((sum, e) => sum + Number(e.net_salary), 0);

  const toggleEntry = (entryId: string, checked: boolean) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(entryId) : next.delete(entryId);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedEntryIds(checked ? new Set(unpaidEntries.map((e) => e.id)) : new Set());
  };

  const handleConfirmPayment = () => {
    if (selectedEntryIds.size === 0 || !paymentLedgerId) return;
    markPaidMutation.mutate({
      entry_ids: Array.from(selectedEntryIds),
      payment_ledger_id: paymentLedgerId,
    });
  };

  const columnHeaders = [
    ...(isApproved && canEdit ? [''] : []),
    'Employee', 'Present / Working', 'Gross', 'PF (Emp)', 'ESI (Emp)', 'PT', 'TDS', 'Deductions', 'Net Salary', '',
  ];

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
                {isApproved && canEdit && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                    />
                  </th>
                )}
                {columnHeaders.slice(isApproved && canEdit ? 1 : 0).map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {(run.entries ?? []).map((entry) => (
                <tr key={entry.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${entry.is_paid ? 'opacity-60' : ''}`}>
                  {isApproved && canEdit && (
                    <td className="px-3 py-3">
                      {entry.is_paid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.has(entry.id)}
                          onChange={(e) => toggleEntry(entry.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                        />
                      )}
                    </td>
                  )}
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
                  <td className="px-3 py-3 text-sm">
                    <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(entry.net_salary)}</span>
                    {entry.is_paid && (
                      <div className="mt-0.5">
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">Paid</span>
                        {entry.payment_voucher?.voucher_number && (
                          <span className="ml-1 font-mono text-xs text-gray-400">({entry.payment_voucher.voucher_number})</span>
                        )}
                      </div>
                    )}
                  </td>
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

        {/* Payment confirm bar — shown when approved and entries are selected */}
        {isApproved && canEdit && selectedEntryIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedEntryIds.size} employee{selectedEntryIds.size > 1 ? 's' : ''} selected
              &nbsp;—&nbsp;
              <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(selectedNetTotal)}</span>
            </span>
            <select
              value={paymentLedgerId}
              onChange={(e) => setPaymentLedgerId(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              {(cashBankLedgers ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.group?.name ? ` (${l.group.name})` : ''}
                </option>
              ))}
              {(!cashBankLedgers || cashBankLedgers.length === 0) && (
                <option value="" disabled>No cash/bank ledgers found</option>
              )}
            </select>
            <Button
              onClick={handleConfirmPayment}
              loading={markPaidMutation.isPending}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Confirm Payment ({selectedEntryIds.size})
            </Button>
          </div>
        )}
      </Card>

      {/* Journal Link */}
      {run.voucher_id && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          Journal entry posted. Voucher: <span className="font-mono font-semibold">{run.voucher_id}</span>
        </div>
      )}

      {/* Payment Vouchers Summary */}
      <PaymentVouchersSummary entries={run.entries ?? []} />
    </div>
  );
}
