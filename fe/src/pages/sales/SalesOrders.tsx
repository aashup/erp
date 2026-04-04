import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { salesOrdersApi } from '@/api/sales';
import { partiesApi } from '@/api/parties';
import { itemsApi } from '@/api/inventory';
import type { SalesOrder } from '@/types';
import { formatCurrency, formatDate, calcGST } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { FilterPanel } from '@/components/ui/FilterPanel';

const lineSchema = z.object({
  item_id: z.string().min(1, 'Item required'),
  quantity: z.coerce.number().min(1, 'Min 1'),
  rate: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const soSchema = z.object({
  so_number: z.string().optional(),
  party_id: z.string().min(1, 'Customer is required'),
  so_date: z.string().min(1, 'Date is required'),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
});

type SoForm = z.infer<typeof soSchema>;

const statusVariant: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  confirmed: 'info',
  partially_delivered: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_delivered: 'Partially Delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const allowedTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['partially_delivered', 'delivered', 'cancelled'],
  partially_delivered: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};


export default function SalesOrders() {
  usePageTitle('Sales Orders');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editSo, setEditSo] = useState<SalesOrder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, search, dateFrom, dateTo, customerFilter, statusFilter],
    queryFn: () => salesOrdersApi.list({
      page: String(page),
      search,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(customerFilter ? { party_id: customerFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    select: (res) => res.data,
  });

  const { data: customersData } = useQuery({
    queryKey: ['parties-customers'],
    queryFn: () => partiesApi.list({ per_page: '500', type: 'customer' }),
    select: (res) => res.data,
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => salesOrdersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); closeModal(); toast.success('Sales order created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => salesOrdersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); closeModal(); toast.success('Sales order updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesOrdersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('Sales order deleted'); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesOrdersApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(res.data.message ?? 'Status updated');
    },
  });

  const handleStatusChange = (so: SalesOrder, newStatus: string) => {
    const messages: Record<string, string> = {
      confirmed: 'Confirming will auto-create a Sales Invoice and deduct stock. Continue?',
      cancelled: 'Are you sure you want to cancel this sales order?',
      delivered: 'Mark this order as fully delivered?',
      partially_delivered: 'Mark this order as partially delivered?',
    };
    if (confirm(messages[newStatus] ?? `Change status to ${newStatus}?`)) {
      statusMutation.mutate({ id: so.id, status: newStatus });
    }
  };

  // Build a lookup map: item_id → Item for auto-populating rate & GST
  const itemMap = new Map((itemsData?.data ?? []).map((i) => [i.id, i]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<SoForm>({
    resolver: zodResolver(soSchema) as any,
    defaultValues: { lines: [{ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  const openCreate = () => {
    setEditSo(null);
    reset({
      so_number: '',
      party_id: '',
      so_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      notes: '',
      lines: [{ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }],
    });
    setShowModal(true);
  };

  const openEdit = (so: SalesOrder) => {
    if (so.status !== 'draft') {
      toast.error('Only draft sales orders can be edited');
      return;
    }
    setEditSo(so);
    reset({
      so_number: so.so_number ?? '',
      party_id: so.party_id,
      so_date: so.so_date,
      expected_delivery_date: so.expected_delivery_date ?? '',
      notes: so.notes ?? '',
      lines: so.lines?.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        rate: l.rate,
        discount_percent: l.discount_percent,
        gst_rate: l.gst_rate,
      })) ?? [{ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditSo(null);
    reset();
  };

  const onSubmit = (formData: SoForm) => {
    const payload = { ...formData } as Record<string, unknown>;
    if (editSo) {
      updateMutation.mutate({ id: editSo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const calcLineTotal = (line: SoForm['lines'][number]) => {
    const taxable = line.quantity * line.rate * (1 - (line.discount_percent ?? 0) / 100);
    const gst = calcGST(taxable, line.gst_rate ?? 18, false);
    return taxable + gst.cgst + gst.sgst + gst.igst;
  };

  const grandTotal = (watchedLines ?? []).reduce((sum, line) => sum + calcLineTotal(line), 0);

  const handleItemChange = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId);
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`lines.${index}.rate`, item.selling_price ?? 0);
      setValue(`lines.${index}.gst_rate`, item.gst_rate ?? 18);
    }
  };

  const customerOptions = (customersData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type ?? 'customer' }));
  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: i.name, subtitle: i.sku ?? i.hsn_code ?? '' }));

  const columns: ColumnDef<SalesOrder, unknown>[] = [
    { accessorKey: 'so_number', header: 'SO #' },
    { header: 'Customer', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'so_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'grand_total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const currentStatus = row.original.status ?? 'draft';
        const transitions = allowedTransitions[currentStatus] ?? [];
        if (transitions.length === 0) {
          return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;
        }
        return (
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(row.original, e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-1 px-2 text-sm focus:border-primary-500 focus:outline-none"
            disabled={statusMutation.isPending}
          >
            <option value={currentStatus}>{statusLabels[currentStatus] ?? currentStatus}</option>
            {transitions.map((s) => (
              <option key={s} value={s}>{statusLabels[s] ?? s}</option>
            ))}
          </select>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isDraft = row.original.status === 'draft';
        return (
          <div className="flex items-center gap-1">
            {isDraft && (
              <>
                <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this SO?')) deleteMutation.mutate(row.original.id); }}
                  className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New SO</Button>
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editSo ? 'Edit Sales Order' : 'New Sales Order'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="so_number" label="SO Number (optional)" placeholder="Auto-generated if empty" error={errors.so_number?.message} {...register('so_number')} />
            <SlideSelect name="party_id" label="Customer" placeholder="Select customer" panelTitle="Select Customer" options={customerOptions} value={watch('party_id')} onChange={(val) => setValue('party_id', val, { shouldValidate: true })} error={errors.party_id?.message} />
            <Input id="so_date" label="SO Date" type="date" error={errors.so_date?.message} {...register('so_date')} />
            <Input id="expected_delivery_date" label="Expected Delivery" type="date" {...register('expected_delivery_date')} />
            <Input id="notes" label="Notes" {...register('notes')} />
          </div>

          {/* Line Items */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Line Items</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append({ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 })}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            {errors.lines?.message && <p className="text-sm text-red-500 mb-2">{errors.lines.message}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                <div className="col-span-4">Item</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-1">Disc %</div>
                <div className="col-span-1">GST %</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <SlideSelect name={`lines.${index}.item_id`} placeholder="Select item" panelTitle="Select Item" options={itemOptions} value={watch(`lines.${index}.item_id`)} onChange={(val) => handleItemChange(index, val)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="1" step="1" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.quantity`)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.rate`)} />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.discount_percent`)} />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none" {...register(`lines.${index}.gst_rate`)} />
                  </div>
                  <div className="col-span-1 flex items-center justify-end py-2 text-sm font-medium">
                    {formatCurrency(calcLineTotal(watchedLines?.[index] ?? { item_id: '', quantity: 0, rate: 0, discount_percent: 0, gst_rate: 0 }))}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <span className="text-sm text-gray-500 dark:text-gray-400">Grand Total: </span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editSo ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Search */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search SO..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Date Range */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date Range
            </label>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Customer Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Customer
            </label>
            {customerFilter && (
              <button onClick={() => { setCustomerFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <SlideSelect
            name="customerFilter"
            placeholder="All Customers"
            panelTitle="Filter by Customer"
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setPage(1); }}
            queryKey={['parties-all']}
            queryFn={(params) => partiesApi.list({ ...params, per_page: '500', type: 'customer' })}
            mapFn={(p: any) => ({ value: p.id, label: p.name })}
          />
        </div>

        {/* Status Filter */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Status
            </label>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                Clear
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="partially_delivered">Partially Delivered</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Clear All Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setDateFrom('');
            setDateTo('');
            setCustomerFilter('');
            setStatusFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>
    </div>
  );
}
