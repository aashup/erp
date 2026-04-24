import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { payrollApi } from '@/api/payroll';
import type { PayrollRun } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Eye, Trash2 } from 'lucide-react';
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

export default function PayrollRuns() {
  usePageTitle('Payroll Runs');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('payroll.create');
  const canDelete = hasPermission('payroll.delete');

  const [showGenModal, setShowGenModal] = useState(false);
  const today = new Date();
  const [genMonth, setGenMonth]         = useState(today.getMonth() + 1);
  const [genYear, setGenYear]           = useState(today.getFullYear());
  const [genWorkingDays, setGenWorkingDays] = useState(26);

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => payrollApi.list(),
    select: (res) => res.data,
  });

  const generateMutation = useMutation({
    mutationFn: () => payrollApi.generate({ month: genMonth, year: genYear, working_days: genWorkingDays }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setShowGenModal(false);
      navigate(`/payroll/runs/${res.data.data.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => payrollApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-runs'] }),
  });

  const columns: ColumnDef<PayrollRun, unknown>[] = [
    {
      id: 'period', header: 'Period',
      cell: ({ row }) => `${MONTHS[row.original.month - 1]} ${row.original.year}`,
    },
    {
      id: 'status', accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <Badge variant={statusVariant[s] ?? 'default'}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
      },
    },
    {
      id: 'total_net', header: 'Net Payable',
      cell: ({ row }) => formatCurrency(row.original.total_net),
    },
    {
      id: 'total_gross', header: 'Gross',
      cell: ({ row }) => formatCurrency(row.original.total_gross),
    },
    {
      id: 'working_days', accessorKey: 'working_days', header: 'Working Days',
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/payroll/runs/${row.original.id}`)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="View"
          >
            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          {canDelete && row.original.status === 'draft' && (
            <button
              onClick={() => { if (confirm('Delete this draft payroll run?')) deleteMutation.mutate(row.original.id); }}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payroll Runs</h1>
        {canCreate && (
          <Button onClick={() => setShowGenModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Generate Payroll
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Monthly payroll processing history</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      <Modal open={showGenModal} onClose={() => setShowGenModal(false)} title="Generate Payroll Run">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
              <select
                value={genMonth}
                onChange={(e) => setGenMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
              <input
                type="number"
                value={genYear}
                onChange={(e) => setGenYear(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                min={2020}
                max={2100}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Days</label>
            <input
              type="number"
              value={genWorkingDays}
              onChange={(e) => setGenWorkingDays(Number(e.target.value))}
              min={1}
              max={31}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            All active employees with salary structures will be included. Present days default to working days — you can adjust them in the run detail.
          </div>
          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowGenModal(false)}>Cancel</Button>
            <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
