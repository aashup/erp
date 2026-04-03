import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { purchaseInvoicesApi } from '@/api/purchase';
import { partiesApi } from '@/api/parties';
import { itemsApi, godownsApi } from '@/api/inventory';
import type { PurchaseInvoice } from '@/types';
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
import { FilterPanel } from '@/components/ui/FilterPanel';

const lineSchema = z.object({
  item_id: z.string().min(1, 'Item required'),
  godown_id: z.string().min(1, 'Godown required'),
  quantity: z.coerce.number().min(1, 'Min 1'),
  rate: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const invoiceSchema = z.object({
  invoice_number: z.string().optional(),
  party_id: z.string().min(1, 'Vendor is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  vendor_invoice_number: z.string().optional(),
  due_date: z.string().optional(),
  is_inter_state: z.boolean().optional().default(false),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

// Edit form — backend only allows status + notes update on draft invoices
const editSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'cancelled']),
  notes: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

const statusVariant: Record<string, 'default' | 'success' | 'danger'> = {
  draft: 'default',
  confirmed: 'success',
  cancelled: 'danger',
};


export default function PurchaseInvoices() {
  usePageTitle('Purchase Invoices');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editInv, setEditInv] = useState<PurchaseInvoice | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', page, search, dateFrom, dateTo, vendorFilter, statusFilter],
    queryFn: () => purchaseInvoicesApi.list({
      page: String(page),
      search,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(vendorFilter ? { party_id: vendorFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
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

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const defaultGodownId = (godownsData?.data ?? []).find((g) => g.is_default)?.id ?? (godownsData?.data ?? [])[0]?.id ?? '';

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => purchaseInvoicesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => purchaseInvoicesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }); closeEditModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseInvoicesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }),
  });

  // Build a lookup map: item_id → Item for auto-populating rate & GST
  const itemMap = new Map((itemsData?.data ?? []).map((i) => [i.id, i]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: { is_inter_state: false, lines: [{ item_id: '', godown_id: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const isInterState = watch('is_inter_state');

  const openCreate = () => {
    setEditInv(null);
    reset({
      invoice_number: '',
      party_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      vendor_invoice_number: '',
      due_date: '',
      is_inter_state: false,
      notes: '',
      lines: [{ item_id: '', godown_id: defaultGodownId, quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }],
    });
    setShowModal(true);
  };

  // Edit form (separate from create form — backend only allows status + notes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEdit, watch: watchEdit, setValue: setEditValue, formState: { errors: editErrors } } = useForm<EditForm>({ resolver: zodResolver(editSchema) as any });

  const openEdit = (inv: PurchaseInvoice) => {
    setEditInv(inv);
    resetEdit({ status: inv.status as EditForm['status'], notes: inv.notes ?? '' });
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    reset();
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInv(null);
    resetEdit();
  };

  const onSubmit = (formData: InvoiceForm) => {
    const payload = { ...formData } as Record<string, unknown>;
    createMutation.mutate(payload);
  };

  const onEditSubmit = (formData: EditForm) => {
    if (editInv) {
      updateMutation.mutate({ id: editInv.id, data: formData as Record<string, unknown> });
    }
  };

  const calcLineTotal = (line: InvoiceForm['lines'][number]) => {
    const taxable = line.quantity * line.rate * (1 - (line.discount_percent ?? 0) / 100);
    const gst = calcGST(taxable, line.gst_rate ?? 18, isInterState ?? false);
    return taxable + gst.cgst + gst.sgst + gst.igst;
  };

  const calcLineTaxable = (line: InvoiceForm['lines'][number]) => {
    return line.quantity * line.rate * (1 - (line.discount_percent ?? 0) / 100);
  };

  const totals = (watchedLines ?? []).reduce(
    (acc, line) => {
      const taxable = calcLineTaxable(line);
      const gst = calcGST(taxable, line.gst_rate ?? 18, isInterState ?? false);
      return {
        taxable: acc.taxable + taxable,
        cgst: acc.cgst + gst.cgst,
        sgst: acc.sgst + gst.sgst,
        igst: acc.igst + gst.igst,
        grand: acc.grand + taxable + gst.cgst + gst.sgst + gst.igst,
      };
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 }
  );

  const handleItemChange = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId);
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`lines.${index}.rate`, item.purchase_price ?? 0);
      setValue(`lines.${index}.gst_rate`, item.gst_rate ?? 18);
    }
  };

  const vendorOptions = (vendorsData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type ?? 'vendor' }));
  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: i.name, subtitle: i.sku ?? i.hsn_code ?? '' }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name, subtitle: g.is_default ? 'Default' : '' }));

  const columns: ColumnDef<PurchaseInvoice, unknown>[] = [
    { accessorKey: 'invoice_number', header: 'Invoice #' },
    { accessorKey: 'vendor_invoice_number', header: 'Vendor Inv #' },
    { header: 'Vendor', cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'invoice_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'grand_total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'balance_due', header: 'Balance', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <Badge variant={statusVariant[s] ?? 'default'}>{s}</Badge>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this invoice?')) deleteMutation.mutate(row.original.id); }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Create Modal */}
      <Modal open={showModal} onClose={closeModal} title="New Purchase Invoice" size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="invoice_number" label="Invoice Number (optional)" placeholder="Auto-generated if empty" error={errors.invoice_number?.message} {...register('invoice_number')} />
            <SlideSelect name="party_id" label="Vendor" placeholder="Select vendor" panelTitle="Select Vendor" options={vendorOptions} value={watch('party_id')} onChange={(val) => setValue('party_id', val, { shouldValidate: true })} error={errors.party_id?.message} />
            <Input id="invoice_date" label="Invoice Date" type="date" error={errors.invoice_date?.message} {...register('invoice_date')} />
            <Input id="vendor_invoice_number" label="Vendor Invoice #" {...register('vendor_invoice_number')} />
            <Input id="due_date" label="Due Date" type="date" {...register('due_date')} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_inter_state" {...register('is_inter_state')} className="rounded" />
            <label htmlFor="is_inter_state" className="text-sm text-gray-700 dark:text-gray-300">Inter-state purchase (IGST instead of CGST+SGST)</label>
          </div>

          {/* Line Items */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Line Items</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append({ item_id: '', godown_id: defaultGodownId, quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 })}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            {errors.lines?.message && <p className="text-sm text-red-500 mb-2">{errors.lines.message}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                <div className="col-span-3">Item</div>
                <div className="col-span-2">Godown</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-1">Disc %</div>
                <div className="col-span-1">GST %</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    <SlideSelect name={`lines.${index}.item_id`} placeholder="Select item" panelTitle="Select Item" options={itemOptions} value={watch(`lines.${index}.item_id`)} onChange={(val) => handleItemChange(index, val)} />
                  </div>
                  <div className="col-span-2">
                    <SlideSelect name={`lines.${index}.godown_id`} placeholder="Select godown" panelTitle="Select Godown" options={godownOptions} value={watch(`lines.${index}.godown_id`)} onChange={(val) => setValue(`lines.${index}.godown_id`, val, { shouldValidate: true })} />
                  </div>
                  <div className="col-span-1">
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
                    {formatCurrency(calcLineTotal(watchedLines?.[index] ?? { item_id: '', godown_id: '', quantity: 0, rate: 0, discount_percent: 0, gst_rate: 0 }))}
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
            {/* GST Totals */}
            <div className="mt-4 border-t dark:border-gray-700 pt-3 space-y-1 text-sm text-right">
              <div><span className="text-gray-500">Taxable: </span><span className="font-medium">{formatCurrency(totals.taxable)}</span></div>
              {isInterState ? (
                <div><span className="text-gray-500">IGST: </span><span className="font-medium">{formatCurrency(totals.igst)}</span></div>
              ) : (
                <>
                  <div><span className="text-gray-500">CGST: </span><span className="font-medium">{formatCurrency(totals.cgst)}</span></div>
                  <div><span className="text-gray-500">SGST: </span><span className="font-medium">{formatCurrency(totals.sgst)}</span></div>
                </>
              )}
              <div className="text-base"><span className="text-gray-500 dark:text-gray-400">Grand Total: </span><span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totals.grand)}</span></div>
            </div>
          </div>

          <Input id="notes" label="Notes" {...register('notes')} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal — only status + notes (backend constraint) */}
      <Modal open={showEditModal} onClose={closeEditModal} title="Edit Purchase Invoice" size="lg">
        {editInv && (
          <div className="space-y-4">
            {/* Read-only invoice summary */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-gray-500 dark:text-gray-400">Invoice #: </span><span className="font-medium text-gray-900 dark:text-gray-100">{editInv.invoice_number}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Vendor: </span><span className="font-medium text-gray-900 dark:text-gray-100">{editInv.party?.name ?? '—'}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Date: </span><span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(editInv.invoice_date)}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Vendor Inv #: </span><span className="font-medium text-gray-900 dark:text-gray-100">{editInv.vendor_invoice_number ?? '—'}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Grand Total: </span><span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(editInv.grand_total)}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Balance Due: </span><span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(editInv.balance_due)}</span></div>
              </div>

              {/* Line items summary */}
              {editInv.lines && editInv.lines.length > 0 && (
                <div className="mt-3 border-t dark:border-gray-700 pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">LINE ITEMS</h4>
                  <div className="space-y-1">
                    {editInv.lines.map((line, idx) => (
                      <div key={line.id ?? idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>{line.item?.name ?? 'Item'} × {line.quantity}</span>
                        <span>{formatCurrency(line.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Editable fields */}
            {editInv.status !== 'draft' ? (
              <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                Only draft invoices can be edited. This invoice is <strong>{editInv.status}</strong>.
              </div>
            ) : (
              <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
                <SlideSelect
                  name="edit_status"
                  label="Status"
                  placeholder="Select status"
                  panelTitle="Select Status"
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'confirmed', label: 'Confirmed' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                  value={watchEdit('status')}
                  onChange={(val) => setEditValue('status', val as EditForm['status'], { shouldValidate: true })}
                  error={editErrors.status?.message}
                />
                <Input id="edit_notes" label="Notes" {...registerEdit('notes')} />
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                  <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                  <Button type="submit" loading={updateMutation.isPending}>Update</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        {/* Search */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            type="text"
            placeholder="Search invoice..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range
          </label>
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

        {/* Vendor Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Vendor
          </label>
          <SlideSelect
            name="vendorFilter"
            placeholder="All Vendors"
            panelTitle="Filter by Vendor"
            value={vendorFilter}
            onChange={(val) => { setVendorFilter(val); setPage(1); }}
            queryKey={['parties-all']}
            queryFn={(params) => partiesApi.list({ ...params, per_page: '500', type: 'vendor' })}
            mapFn={(p: any) => ({ value: p.id, label: p.name })}
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </FilterPanel>
    </div>
  );
}
