import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/authStore';
import { partiesApi } from '@/api/parties';
import { itemsApi, godownsApi, stockLedgerApi } from '@/api/inventory';
import { salesInvoicesApi } from '@/api/sales';
import { formatCurrency, calcGST } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Plus, ArrowLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';

const lineSchema = z.object({
  item_id: z.string().min(1, 'Item required'),
  godown_id: z.string().min(1, 'Godown required'),
  quantity: z.coerce.number().min(1, 'Min 1'),
  rate: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required'),
  party_id: z.string().min(1, 'Customer is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  due_date: z.string().optional(),
  is_inter_state: z.boolean().optional().default(false),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const makeEmptyLine = (defaultGodownId = ''): InvoiceForm['lines'][number] => ({
  item_id: '',
  godown_id: defaultGodownId,
  quantity: 1,
  rate: 0,
  discount_percent: 0,
  gst_rate: 18,
});

export default function SalesInvoiceFormPage() {
  usePageTitle('Sales Invoice');
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const isEditMode = Boolean(invoiceId);
  const queryClient = useQueryClient();

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

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: invoiceData, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['sales-invoice', invoiceId],
    queryFn: () => salesInvoicesApi.get(invoiceId!),
    enabled: isEditMode,
    select: (res) => res.data.data,
  });

  const defaultGodownId =
    (godownsData?.data ?? []).find((g) => g.is_default)?.id ??
    (godownsData?.data ?? [])[0]?.id ??
    '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      invoice_number: '',
      party_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      is_inter_state: false,
      notes: '',
      lines: [makeEmptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const isInterState = watch('is_inter_state');
  const company = useAuthStore((state) => state.user?.company);

  useEffect(() => {
    if (isEditMode || !defaultGodownId) {
      return;
    }

    const currentLines = watch('lines') ?? [];
    currentLines.forEach((line, index) => {
      if (!line.godown_id) {
        setValue(`lines.${index}.godown_id`, defaultGodownId, { shouldDirty: false });
      }
    });
  }, [defaultGodownId, isEditMode, setValue, watch]);

  useEffect(() => {
    if (!invoiceData) {
      return;
    }

    if (invoiceData.status !== 'draft') {
      toast.error('Only draft invoices can be edited');
      navigate('/sales/invoices');
      return;
    }

    reset({
      invoice_number: invoiceData.invoice_number ?? '',
      party_id: invoiceData.party_id,
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date ?? '',
      is_inter_state: invoiceData.is_inter_state,
      notes: invoiceData.notes ?? '',
      lines: invoiceData.lines?.map((line) => ({
        item_id: line.item_id,
        godown_id: (line as unknown as { godown_id?: string }).godown_id ?? defaultGodownId,
        quantity: line.quantity,
        rate: line.rate,
        discount_percent: line.discount_percent,
        gst_rate: line.gst_rate,
      })) ?? [makeEmptyLine(defaultGodownId)],
    });
  }, [defaultGodownId, invoiceData, navigate, reset]);

  // Auto-detect inter-state based on customer state
  useEffect(() => {
    const customerId = watch('party_id');
    if (!customerId || !company) {
      return;
    }

    const customer = (customersData?.data ?? []).find((c) => c.id === customerId);
    if (!customer) {
      return;
    }

    const autoIsInterState = company.state_code !== (customer.state_code ?? company.state_code);
    setValue('is_inter_state', autoIsInterState, { shouldDirty: true });
  }, [watch('party_id'), company, customersData, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => salesInvoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('Sales invoice created');
      navigate('/sales/invoices');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => salesInvoicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      if (invoiceId) {
        queryClient.invalidateQueries({ queryKey: ['sales-invoice', invoiceId] });
      }
      toast.success('Sales invoice updated');
      navigate('/sales/invoices');
    },
  });

  const itemMap = useMemo(
    () => new Map((itemsData?.data ?? []).map((item) => [item.id, item])),
    [itemsData?.data]
  );

  const { data: stockSummaryData } = useQuery({
    queryKey: ['stock-summary-all'],
    queryFn: () => stockLedgerApi.summary({ per_page: '999' }),
    select: (res) => res.data,
  });

  const stockSummaryMap = useMemo(() => {
    const map = new Map<string, number>();
    (stockSummaryData?.data ?? []).forEach((row) => {
      const key = `${row.item_id}:${row.godown_id}`;
      map.set(key, row.current_stock ?? 0);
    });
    return map;
  }, [stockSummaryData?.data]);

  const customerOptions = (customersData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type ?? 'customer' }));
  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: i.name, subtitle: i.sku ?? i.hsn_code ?? '' }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name, subtitle: g.is_default ? 'Default' : '' }));

  const getLineGSTInfo = (lineIndex: number) => {
    const line = watchedLines?.[lineIndex];
    if (!line?.item_id || !line?.rate) return null;

    const selectedItem = itemMap.get(line.item_id);
    if (!selectedItem) return null;

    const customerId = watch('party_id');
    if (!customerId) return null;

    const customer = (customersData?.data ?? []).find((c) => c.id === customerId);
    if (!customer || !company) return null;

    const lineIsInterState = company.state_code !== (customer.state_code ?? company.state_code);

    const taxable = calcLineTaxable(line);
    const gst = calcGST(taxable, line.gst_rate ?? 18, lineIsInterState);

    if (lineIsInterState) {
      const igst = selectedItem.igst ?? 0;
      return `Applicable GST IGST = ${igst}% (₹${gst.igst.toFixed(2)})`;
    }
    const cgst = selectedItem.cgst ?? 0;
    const sgst = selectedItem.sgst ?? 0;
    return `Applicable GST CGST = ${cgst}% (₹${gst.cgst.toFixed(2)}) and SGST = ${sgst}% (₹${gst.sgst.toFixed(2)})`;
  };

  const getLineAvailableQty = (lineIndex: number) => {
    const line = watchedLines?.[lineIndex];
    if (!line?.item_id || !line?.godown_id) return null;

    const key = `${line.item_id}:${line.godown_id}`;
    const qty = stockSummaryMap.get(key) ?? 0;
    const item = itemMap.get(line.item_id);
    const unit = item?.unit ?? '';

    return `${qty} ${unit}`;
  };

  const handleItemSelect = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId, { shouldDirty: true, shouldValidate: true });

    const selectedItem = itemMap.get(itemId);
    if (!selectedItem) {
      return;
    }

    const rate = selectedItem.selling_price ?? selectedItem.mrp ?? selectedItem.purchase_price ?? 0;
    setValue(`lines.${index}.rate`, Number(rate), { shouldDirty: true, shouldValidate: true });

    // Select appropriate GST rate based on customer and item state
    const customerId = watch('party_id');
    let lineIsInterState = isInterState;

    if (customerId && company) {
      const customer = (customersData?.data ?? []).find((c) => c.id === customerId);
      if (customer) {
        lineIsInterState = company.state_code !== (customer.state_code ?? company.state_code);
      }
    }

    const igst = selectedItem.igst ?? 0;
    const sgst = selectedItem.sgst ?? 0;
    const cgst = selectedItem.cgst ?? 0;
    const gstRate = lineIsInterState ? (igst > 0 ? igst : 18) : ((sgst + cgst) > 0 ? (sgst + cgst) : 18);
    setValue(`lines.${index}.gst_rate`, Number(gstRate), { shouldDirty: true, shouldValidate: true });
  };

  const calcLineTaxable = (line: InvoiceForm['lines'][number]) =>
    line.quantity * line.rate * (1 - (line.discount_percent ?? 0) / 100);

  const calcLineTotal = (line: InvoiceForm['lines'][number]) => {
    const taxable = calcLineTaxable(line);
    const gst = calcGST(taxable, line.gst_rate ?? 18, isInterState ?? false);
    return taxable + gst.cgst + gst.sgst + gst.igst;
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

  const onSubmit = (formData: InvoiceForm) => {
    const payload = {
      ...formData,
      lines: formData.lines.map((line) => ({
        ...line,
        line_total: calcLineTaxable(line),
      })),
    } as Record<string, unknown>;

    if (isEditMode && invoiceId) {
      updateMutation.mutate({ id: invoiceId, data: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/sales/invoices')}
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Sales Invoice' : 'New Sales Invoice'}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Invoice Details</h2>
        </CardHeader>
        <CardContent>
          {isInvoiceLoading ? (
            <div className="py-8 text-sm text-gray-500 dark:text-gray-400">Loading invoice...</div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  id="invoice_number"
                  label="Invoice Number"
                  placeholder="INV-0001"
                  error={errors.invoice_number?.message}
                  {...register('invoice_number')}
                />
                <SlideSelect
                  name="party_id"
                  label="Customer"
                  placeholder="Select customer"
                  panelTitle="Select Customer"
                  options={customerOptions}
                  value={watch('party_id')}
                  onChange={(val) => setValue('party_id', val, { shouldValidate: true })}
                  error={errors.party_id?.message}
                />
                <Input
                  id="invoice_date"
                  label="Invoice Date"
                  type="date"
                  error={errors.invoice_date?.message}
                  {...register('invoice_date')}
                />
                <Input id="due_date" label="Due Date" type="date" {...register('due_date')} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_inter_state" {...register('is_inter_state')} className="rounded" />
                <label htmlFor="is_inter_state" className="text-sm text-gray-700 dark:text-gray-300">
                  Inter-state sale (IGST instead of CGST+SGST)
                </label>
              </div>

              <div className="border-t dark:border-gray-700 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Line Items</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => append(makeEmptyLine(defaultGodownId))}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Line
                  </Button>
                </div>

                {errors.lines?.message && <p className="mb-2 text-sm text-red-500">{errors.lines.message}</p>}

                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="col-span-3">Item</div>
                    <div className="col-span-2">Godown</div>
                    <div className="col-span-1">Qty</div>
                    <div className="col-span-2">Rate (₹)</div>
                    <div className="col-span-2">Disc %</div>
                    <div className="col-span-1 text-right">Taxable</div>
                    <div className="col-span-1"></div>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2">
                      <div className="grid grid-cols-12 items-start gap-2">
                        <div className="col-span-3">
                          <SlideSelect name={`lines.${index}.item_id`} placeholder="Select item" panelTitle="Select Item" options={itemOptions} value={watch(`lines.${index}.item_id`)} onChange={(val) => handleItemSelect(index, val)} />
                        </div>
                        <div className="col-span-2">
                          <SlideSelect name={`lines.${index}.godown_id`} placeholder="Select godown" panelTitle="Select Godown" options={godownOptions} value={watch(`lines.${index}.godown_id`)} onChange={(val) => setValue(`lines.${index}.godown_id`, val, { shouldValidate: true })} />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            {...register(`lines.${index}.quantity`)}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="0.00"
                            {...register(`lines.${index}.rate`)}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            {...register(`lines.${index}.discount_percent`)}
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-end py-2 text-sm font-medium">
                          {formatCurrency(calcLineTaxable(watchedLines?.[index] ?? { item_id: '', godown_id: '', quantity: 0, rate: 0, discount_percent: 0, gst_rate: 0 }))}
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                              <X className="h-4 w-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                      {getLineGSTInfo(index) && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 pl-1 flex justify-between items-center">
                          <span>{getLineGSTInfo(index)}</span>
                          {getLineAvailableQty(index) && <span className="text-right bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-blue-900 dark:text-blue-200 font-semibold">Available Qty: {getLineAvailableQty(index)}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t dark:border-gray-700 pt-3 space-y-1 text-sm text-right">
                  <div><span className="text-gray-500">Taxable: </span><span className="font-medium">{formatCurrency(totals.taxable)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>CGST: </span><span className={`font-medium ${isInterState ? 'text-gray-400' : ''}`}>{formatCurrency(totals.cgst)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>SGST: </span><span className={`font-medium ${isInterState ? 'text-gray-400' : ''}`}>{formatCurrency(totals.sgst)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>IGST: </span><span className={`font-medium ${isInterState ? '' : 'text-gray-400'}`}>{formatCurrency(totals.igst)}</span></div>
                  <div className="text-base"><span className="text-gray-500 dark:text-gray-400">Grand Total: </span><span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totals.grand)}</span></div>
                </div>
              </div>

              <Input id="notes" label="Notes" {...register('notes')} />

              <div className="flex justify-end gap-3 border-t dark:border-gray-700 pt-4">
                <Button type="button" variant="secondary" onClick={() => navigate('/sales/invoices')}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                  {isEditMode ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
