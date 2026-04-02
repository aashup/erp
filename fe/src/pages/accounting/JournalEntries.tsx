import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { vouchersApi, ledgersApi } from '@/api/accounting';
import type { Voucher } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSelectedFYId } from '@/hooks/useFinancialYear';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Eye, X } from 'lucide-react';

const journalLineSchema = z.object({
  ledger_id: z.string().min(1, 'Ledger required'),
  debit: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  credit: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  narration: z.string().optional(),
});

const journalSchema = z.object({
  voucher_date: z.string().min(1, 'Date is required'),
  voucher_type: z.enum(['journal', 'contra', 'payment', 'receipt', 'purchase', 'sales']),
  narration: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum1, l1) => sum1 + (Number(l1.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits', path: ['lines'] }
);

type JournalForm = z.infer<typeof journalSchema>;

export default function JournalEntries() {
  usePageTitle('Journal Entries');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Voucher | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', page, search],
    queryFn: () => vouchersApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const { data: ledgersData } = useQuery({
    queryKey: ['ledgers-all'],
    queryFn: () => ledgersApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vouchersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vouchers'] }); closeModal(); },
  });

  const fyId = useSelectedFYId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<JournalForm>({
    resolver: zodResolver(journalSchema) as any,
    defaultValues: {
      voucher_type: 'journal',
      lines: [
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  const totalDebit = (watchedLines ?? []).reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = (watchedLines ?? []).reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const openCreate = () => {
    reset({
      voucher_date: new Date().toISOString().split('T')[0],
      voucher_type: 'journal',
      narration: '',
      lines: [
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
        { ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' },
      ],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    reset();
  };

  const onSubmit = (formData: JournalForm) => {
    createMutation.mutate({
      ...formData,
      financial_year_id: fyId,
    } as unknown as Record<string, unknown>);
  };

  const ledgerOptions = (ledgersData?.data ?? []).map((l) => ({ value: l.id, label: l.name, subtitle: l.group?.name ?? '' }));

  const columns: ColumnDef<Voucher, unknown>[] = [
    { accessorKey: 'voucher_number', header: 'Voucher #' },
    { accessorKey: 'voucher_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'voucher_type', header: 'Type', cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => <span className="truncate max-w-[200px] block">{(getValue() as string) ?? '—'}</span> },
    { accessorKey: 'is_posted', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'warning'}>{getValue() ? 'Posted' : 'Draft'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button onClick={() => setShowDetail(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Journal Entries</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="Search voucher..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Create Modal */}
      <Modal open={showModal} onClose={closeModal} title="New Journal Entry" size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="voucher_date" label="Voucher Date" type="date" error={errors.voucher_date?.message} {...register('voucher_date')} />
            <SlideSelect name="voucher_type" label="Voucher Type" placeholder="Select type" panelTitle="Select Voucher Type" options={[
              { value: 'journal', label: 'Journal' },
              { value: 'contra', label: 'Contra' },
              { value: 'payment', label: 'Payment' },
              { value: 'receipt', label: 'Receipt' },
              { value: 'purchase', label: 'Purchase' },
              { value: 'sales', label: 'Sales' },
            ]} value={watch('voucher_type')} onChange={(val) => setValue('voucher_type', val as JournalForm['voucher_type'], { shouldValidate: true })} error={errors.voucher_type?.message} />
          </div>
          <Input id="narration" label="Narration" {...register('narration')} />

          {/* Journal Lines */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Entries (Debit = Credit)</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append({ ledger_id: '', debit: '' as unknown as number, credit: '' as unknown as number, narration: '' })}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            {typeof errors.lines?.message === 'string' && <p className="text-sm text-red-500 mb-2">{errors.lines.message}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                <div className="col-span-5">Ledger</div>
                <div className="col-span-2">Debit (₹)</div>
                <div className="col-span-2">Credit (₹)</div>
                <div className="col-span-2">Narration</div>
                <div className="col-span-1"></div>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <SlideSelect name={`lines.${index}.ledger_id`} placeholder="Select ledger" panelTitle="Select Ledger" options={ledgerOptions} value={watch(`lines.${index}.ledger_id`)} onChange={(val) => setValue(`lines.${index}.ledger_id`, val, { shouldValidate: true })} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.debit`)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.credit`)} />
                  </div>
                  <div className="col-span-2">
                    <input className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" placeholder="Note" {...register(`lines.${index}.narration`)} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {fields.length > 2 && (
                      <button type="button" onClick={() => remove(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="mt-4 border-t dark:border-gray-700 pt-3 grid grid-cols-12 gap-2 text-sm font-semibold">
              <div className="col-span-5 text-right text-gray-500 dark:text-gray-400">Totals:</div>
              <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalDebit)}</div>
              <div className={`col-span-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalCredit)}</div>
              <div className="col-span-3">
                {isBalanced ? (
                  <Badge variant="success">Balanced</Badge>
                ) : (
                  <Badge variant="danger">Diff: {formatCurrency(Math.abs(totalDebit - totalCredit))}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!isBalanced}>Create Entry</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Voucher: ${showDetail?.voucher_number ?? ''}`} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Date: </span><span className="font-medium">{formatDate(showDetail.voucher_date)}</span></div>
              <div><span className="text-gray-500">Type: </span><Badge>{showDetail.voucher_type}</Badge></div>
              <div><span className="text-gray-500">Status: </span><Badge variant={showDetail.is_posted ? 'success' : 'warning'}>{showDetail.is_posted ? 'Posted' : 'Draft'}</Badge></div>
              {showDetail.narration && <div className="col-span-2"><span className="text-gray-500">Narration: </span><span>{showDetail.narration}</span></div>}
            </div>
            {showDetail.lines && showDetail.lines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2">Ledger</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {showDetail.lines.map((line) => (
                    <tr key={line.id} className="border-b dark:border-gray-700">
                      <td className="py-2">{line.ledger?.name ?? line.ledger_id}</td>
                      <td className="py-2 text-right">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td className="py-2 text-right">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{formatCurrency(showDetail.lines.reduce((s, l) => s + l.debit, 0))}</td>
                    <td className="py-2 text-right">{formatCurrency(showDetail.lines.reduce((s, l) => s + l.credit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
