import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { purchaseOrdersApi } from '@/api/purchase';
import { partiesApi } from '@/api/parties';
import { itemsApi } from '@/api/inventory';
import type { PurchaseOrder } from '@/types';
import { formatCurrency, formatDate, calcGST } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';

const lineSchema = z.object({
  item_id: z.string().min(1, 'Item required'),
  quantity: z.coerce.number().min(1, 'Min 1'),
  rate: z.coerce.number().min(0, 'Min 0'),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const poSchema = z.object({
  po_number: z.string().optional(),
  party_id: z.string().min(1, 'Vendor is required'),
  po_date: z.string().min(1, 'Date is required'),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
});

type PoForm = z.infer<typeof poSchema>;

const statusVariant: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  confirmed: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'danger',
};

// Which statuses can a given status transition to?
const allowedTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export default function PurchaseOrders() {
  usePageTitle('Purchase Orders');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPo, setEditPo] = useState<PurchaseOrder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search],
    queryFn: () => purchaseOrdersApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['parties-vendors'],
    queryFn: () => partiesApi.list({ per_page: '500', type: 'vendor' }),
    select: (res) => res.data,
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => purchaseOrdersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); closeModal(); toast.success('Purchase order created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => purchaseOrdersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); closeModal(); toast.success('Purchase order updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Purchase order deleted'); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseOrdersApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      const msg = res.data?.message ?? 'Status updated';
      toast.success(msg);
    },
  });

  // Build a lookup map: item_id → Item for auto-populating rate & GST
  const itemMap = new Map((itemsData?.data ?? []).map((i) => [i.id, i]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<PoForm>({
    resolver: zodResolver(poSchema) as any,
    defaultValues: { lines: [{ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  const openCreate = () => {
    setEditPo(null);
    reset({
      po_number: '',
      party_id: '',
      po_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      notes: '',
      lines: [{ item_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }],
    });
    setShowModal(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditPo(po);
    reset({
      po_number: po.po_number ?? '',
      party_id: po.party_id,
      po_date: po.po_date,
      expected_delivery_date: po.expected_delivery_date ?? '',
      notes: po.notes ?? '',
      lines: po.lines?.map((l) => ({
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
    setEditPo(null);
    reset();
  };

  const onSubmit = (formData: PoForm) => {
    const payload = { ...formData } as Record<string, unknown>;
    if (editPo) {
      updateMutation.mutate({ id: editPo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStatusChange = (po: PurchaseOrder, newStatus: string) => {
    if (newStatus === po.status) return;

    const label = statusLabels[newStatus] ?? newStatus;
    const confirmMsg = newStatus === 'confirmed'
      ? `Confirm PO "${po.po_number}"? This will auto-create a Purchase Invoice and add stock.`
      : newStatus === 'cancelled'
        ? `Cancel PO "${po.po_number}"? This cannot be undone.`
        : `Change status of "${po.po_number}" to "${label}"?`;

    if (confirm(confirmMsg)) {
      statusMutation.mutate({ id: po.id, status: newStatus });
    }
  };

  // Calculate line totals for preview
  const calcLineTotal = (line: PoForm['lines'][number]) => {
    const taxable = line.quantity * line.rate * (1 - (line.discount_percent ?? 0) / 100);
    const gst = calcGST(taxable, line.gst_rate ?? 18, false);
    return taxable + gst.cgst + gst.sgst + gst.igst;
  };

  const grandTotal = (watchedLines ?? []).reduce((sum, line) => sum + calcLineTotal(line), 0);

  const handleItemChange = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId);
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`lines.${index}.rate`, item.purchase_price ?? 0);
      setValue(`lines.${index}.gst_rate`, item.gst_rate ?? 18);
    }
  };

  const vendorOptions = (vendorsData?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: `${i.name} (${i.sku ?? i.hsn_code ?? ''})` }));

  const columns: ColumnDef<PurchaseOrder, unknown>[] = [
    { accessorKey: 'po_number', header: 'PO #' },
    { header: 'Vendor', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'po_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'grand_total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const po = row.original;
        const currentStatus = po.status;
        const transitions = allowedTransitions[currentStatus] ?? [];

        // If no transitions available, just show badge
        if (transitions.length === 0) {
          return <Badge variant={statusVariant[currentStatus] ?? 'default'}>{statusLabels[currentStatus] ?? currentStatus}</Badge>;
        }

        return (
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-1 px-2 text-xs font-medium focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={currentStatus}
            disabled={statusMutation.isPending}
            onChange={(e) => handleStatusChange(po, e.target.value)}
          >
            <option value={currentStatus}>{statusLabels[currentStatus]}</option>
            {transitions.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
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
              <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {isDraft && (
              <button
                onClick={() => { if (confirm('Delete this PO?')) deleteMutation.mutate(row.original.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New PO</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Search PO number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editPo ? 'Edit Purchase Order' : 'New Purchase Order'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="po_number" label="PO Number (optional)" placeholder="Auto-generated if empty" error={errors.po_number?.message} {...register('po_number')} />
            <Select id="party_id" label="Vendor" options={vendorOptions} error={errors.party_id?.message} {...register('party_id')} />
            <Input id="po_date" label="PO Date" type="date" error={errors.po_date?.message} {...register('po_date')} />
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
                    <select
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                      {...register(`lines.${index}.item_id`)}
                      onChange={(e) => handleItemChange(index, e.target.value)}
                    >
                      <option value="">Select item</option>
                      {itemOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {errors.lines?.[index]?.item_id && <p className="text-xs text-red-500 mt-1">{errors.lines[index]?.item_id?.message}</p>}
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
              {editPo ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
