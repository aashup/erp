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


  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => payrollApi.list(),
    select: (res) => res.data,
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
          <Button onClick={() => navigate('/payroll/runs/new')}>
            <Plus className="mr-2 h-4 w-4" /> Generate Payroll
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Monthly payroll processing history</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

    </div>
  );
}
