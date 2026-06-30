import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useFYBounds } from '@/hooks/useFinancialYear';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { buildSyncRecord } from '@/lib/sync';
import { useDateStore } from '@/store/dateStore';
import { partiesApi } from '@/api/parties';
import { itemsApi, godownsApi, stockLedgerApi, batchesApi } from '@/api/inventory';
import { purchaseInvoicesApi } from '@/api/purchase';
import { formatCurrency, calcGST, formatDate, dateToUtcIso, apiDateToLocalDate } from '@/lib/utils';
import type { Batch } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { PartyFormModal } from '@/components/ui/PartyFormModal';
import { BatchFormModal } from '@/components/ui/BatchFormModal';
import { Plus, ArrowLeft, X, PackageOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const lineSchema = z.object({
  item_id: z.string().min(1, 'Item required'),
  batch_id: z.string().optional(),
  godown_id: z.string().min(1, 'Godown required'),
  quantity: z.coerce.number().min(0.001, 'Min 0.001'),
  unit: z.string().optional(),
  conversion_factor: z.coerce.number().optional().default(1),
  rate: z.coerce.number().min(0, 'Rate required'),
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

const makeEmptyLine = (defaultGodownId = ''): InvoiceForm['lines'][number] => ({
  item_id: '',
  batch_id: '',
  godown_id: defaultGodownId,
  quantity: 1,
  unit: undefined,
  conversion_factor: 1,
  rate: 0,
  discount_percent: 0,
  gst_rate: 18,
});

export default function PurchaseInvoiceFormPage() {
  usePageTitle('Purchase Invoice');
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const isEditMode = Boolean(invoiceId);
  const queryClient = useQueryClient();
  const [showAddVendor, setShowAddVendor] = useState(false);

  const { selectedDate } = useDateStore();
  const fyBounds = useFYBounds();

  const validatedSchema = useMemo(() => {
    if (!fyBounds) return invoiceSchema;
    return invoiceSchema.superRefine((data, ctx) => {
      if (data.invoice_date && (data.invoice_date < fyBounds.start || data.invoice_date > fyBounds.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Date must be within FY ${fyBounds.label}`, path: ['invoice_date'] });
      }
    });
  }, [fyBounds?.start, fyBounds?.end, fyBounds?.label]);

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

  const { data: invoiceData, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['purchase-invoice', invoiceId],
    queryFn: () => purchaseInvoicesApi.get(invoiceId!),
    enabled: isEditMode,
    select: (res) => res.data.data,
  });

  const defaultGodownId =
    (godownsData?.data ?? []).find((g) => g.is_default)?.id ??
    (godownsData?.data ?? [])[0]?.id ??
    '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(validatedSchema) as any,
    defaultValues: {

      invoice_number: '',
      party_id: '',
      invoice_date: selectedDate,
      vendor_invoice_number: '',
      due_date: selectedDate,
      is_inter_state: false,
      notes: '',
      lines: [makeEmptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const isInterState = watch('is_inter_state');
  const company = useAuthStore((state) => state.user?.company);
  const user = useAuthStore((state) => state.user);
  const isOnline = useOnlineStatus();

  // Cache of batches per item_id: { [itemId]: Batch[] }
  const [batchesCache, setBatchesCache] = useState<Record<string, Batch[]>>({});
  const [addBatchForItem, setAddBatchForItem] = useState<{ itemId: string; itemName: string } | null>(null);

  const loadBatches = (itemId: string) => {
    if (!itemId || batchesCache[itemId] !== undefined) return;
    batchesApi.list(itemId).then((res) => {
      setBatchesCache((prev) => ({ ...prev, [itemId]: res.data.data as Batch[] }));
    });
  };

  const refreshBatches = (itemId: string) => {
    batchesApi.list(itemId).then((res) => {
      setBatchesCache((prev) => ({ ...prev, [itemId]: res.data.data as Batch[] }));
    });
  };

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
      navigate('/purchase/invoices');
      return;
    }

    reset({

      invoice_number: invoiceData.invoice_number ?? '',
      party_id: invoiceData.party_id,
      invoice_date: apiDateToLocalDate(invoiceData.invoice_date as string),
      vendor_invoice_number: invoiceData.vendor_invoice_number ?? '',
      due_date: invoiceData.due_date ?? '',
      is_inter_state: invoiceData.is_inter_state,
      notes: invoiceData.notes ?? '',
      lines: invoiceData.lines?.map((line) => ({
        item_id: line.item_id,
        batch_id: line.batch_id ?? '',
        godown_id: (line as unknown as { godown_id?: string }).godown_id ?? defaultGodownId,
        quantity: line.quantity,
        unit: line.unit ?? undefined,
        conversion_factor: line.conversion_factor ?? 1,
        rate: line.rate ?? 0,
        discount_percent: line.discount_percent,
        gst_rate: line.gst_rate,
      })) ?? [makeEmptyLine(defaultGodownId)],
    });

    // Load batches for any batch-tracked items in edit mode
    invoiceData.lines?.forEach((line) => {
      const item = itemMap.get(line.item_id);
      if (item?.is_batch_tracked) {
        loadBatches(line.item_id);
      }
    });
  }, [defaultGodownId, invoiceData, navigate, reset]);

  // Auto-detect inter-state based on vendor state
  useEffect(() => {
    const vendorId = watch('party_id');
    if (!vendorId || !company) {
      return;
    }

    const vendor = (vendorsData?.data ?? []).find((v) => v.id === vendorId);
    if (!vendor) {
      return;
    }

    const autoIsInterState = company.state_code !== (vendor.state_code ?? company.state_code);
    setValue('is_inter_state', autoIsInterState, { shouldDirty: true });
  }, [watch('party_id'), company, vendorsData, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { lines, ...header } = data as { lines: Record<string, unknown>[]; [k: string]: unknown };
      const invoiceRecord = buildSyncRecord<import('@/types').PurchaseInvoice>(header, user!.company_id);
      await db.purchaseInvoices.put(invoiceRecord);
      for (const line of (lines ?? [])) {
        await db.purchaseInvoiceLines.put(
          buildSyncRecord<import('@/types').PurchaseInvoiceLine>(
            { ...line, purchase_invoice_id: invoiceRecord.id },
            user!.company_id,
          ),
        );
      }
      if (isOnline) {
        const res = await purchaseInvoicesApi.create(data);
        await db.purchaseInvoices.put({ ...res.data.data, sync_status: 'synced' });
        await db.purchaseInvoices.delete(invoiceRecord.id);
        return res;
      }
      toast('Saved offline — will sync when back online');
      return { data: { data: invoiceRecord } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Purchase invoice created');
      navigate('/purchase/invoices');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { lines, ...header } = data as { lines: Record<string, unknown>[]; [k: string]: unknown };
      const existing = await db.purchaseInvoices.get(id);
      const invoiceRecord = buildSyncRecord<import('@/types').PurchaseInvoice>(
        { ...existing, ...header },
        user!.company_id,
        id,
        existing?.created_at,
      );
      await db.purchaseInvoices.put(invoiceRecord);
      for (const line of (lines ?? [])) {
        await db.purchaseInvoiceLines.put(
          buildSyncRecord<import('@/types').PurchaseInvoiceLine>(
            { ...line, purchase_invoice_id: id },
            user!.company_id,
            (line as { id?: string }).id,
          ),
        );
      }
      if (isOnline) {
        const res = await purchaseInvoicesApi.update(id, data);
        await db.purchaseInvoices.put({ ...res.data.data, sync_status: 'synced' });
        return res;
      }
      toast('Saved offline — will sync when back online');
      return { data: { data: invoiceRecord } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      if (invoiceId) {
        queryClient.invalidateQueries({ queryKey: ['purchase-invoice', invoiceId] });
      }
      toast.success('Purchase invoice updated');
      navigate('/purchase/invoices');
    },
  });

  const itemMap = useMemo(
    () => new Map((itemsData?.data ?? []).map((item) => [item.id, item])),
    [itemsData?.data]
  );

  const vendorOptions = (vendorsData?.data ?? []).map((p) => ({ value: p.id, label: p.name, subtitle: p.type ?? 'vendor' }));
  const itemOptions = (itemsData?.data ?? []).map((i) => ({ value: i.id, label: i.name, subtitle: i.sku ?? i.hsn_code ?? '' }));
  const godownOptions = (godownsData?.data ?? []).map((g) => ({ value: g.id, label: g.name, subtitle: g.is_default ? 'Default' : '' }));

  const { data: stockSummaryData } = useQuery({
    queryKey: ['stock-summary-all'],
    queryFn: () => stockLedgerApi.summary({ per_page: '999' }),
    select: (res) => res.data,
  });

  const stockSummaryMap = useMemo(() => {
    const map = new Map<string, number>();
    (stockSummaryData?.data ?? []).forEach((row) => {
      const key = `${row.item_id}:${row.godown_id}`;
      map.set(key, Number(row.current_stock ?? 0));
    });
    return map;
  }, [stockSummaryData?.data]);

  const getLineGSTInfo = (lineIndex: number) => {
    const line = watchedLines?.[lineIndex];
    if (!line?.item_id || !line?.rate) return null;

    const selectedItem = itemMap.get(line.item_id);
    if (!selectedItem) return null;

    const vendorId = watch('party_id');
    if (!vendorId) return null;

    const vendor = (vendorsData?.data ?? []).find((v) => v.id === vendorId);
    if (!vendor || !company) return null;

    const lineIsInterState = company.state_code !== (vendor.state_code ?? company.state_code);

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
    const baseUnit = item?.unit ?? '';

    return `${parseFloat(qty.toFixed(3))} ${baseUnit} (stock)`;
  };

  const handleItemSelect = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId, { shouldDirty: true, shouldValidate: true });
    setValue(`lines.${index}.batch_id`, '', { shouldDirty: true }); // Clear batch when item changes

    const selectedItem = itemMap.get(itemId);
    if (!selectedItem) return;

    // Load batches for batch-tracked items
    if (selectedItem.is_batch_tracked) {
      loadBatches(itemId);
    }

    // Auto-select default_purchase alternate unit, else fall back to base unit
    const defaultAu = (selectedItem.alternate_units ?? []).find((au) => au.is_default_purchase);
    if (defaultAu) {
      setValue(`lines.${index}.unit`, defaultAu.unit, { shouldDirty: true });
      setValue(`lines.${index}.conversion_factor`, defaultAu.conversion_factor, { shouldDirty: true });
    } else {
      setValue(`lines.${index}.unit`, selectedItem.unit, { shouldDirty: true });
      setValue(`lines.${index}.conversion_factor`, 1, { shouldDirty: true });
    }

    // Autofill rate from purchase_price (rate is always per base unit)
    if (selectedItem.purchase_price) {
      setValue(`lines.${index}.rate`, parseFloat(Number(selectedItem.purchase_price).toFixed(2)), { shouldDirty: true, shouldValidate: true });
    }

    // Select appropriate GST rate based on vendor and item state
    const vendorId = watch('party_id');
    let lineIsInterState = isInterState;

    if (vendorId && company) {
      const vendor = (vendorsData?.data ?? []).find((v) => v.id === vendorId);
      if (vendor) {
        lineIsInterState = company.state_code !== (vendor.state_code ?? company.state_code);
      }
    }

    const igst = selectedItem.igst ?? 0;
    const sgst = selectedItem.sgst ?? 0;
    const cgst = selectedItem.cgst ?? 0;
    const gstRate = lineIsInterState ? (igst > 0 ? igst : 18) : ((sgst + cgst) > 0 ? (sgst + cgst) : 18);
    setValue(`lines.${index}.gst_rate`, gstRate, { shouldDirty: true, shouldValidate: true });
  };

  // Rate is per base unit; taxable = base_quantity * rate * (1 - discount%)
  const calcLineTaxable = (line: InvoiceForm['lines'][number]) => {
    const baseQty = (line.quantity ?? 0) * (line.conversion_factor ?? 1);
    return baseQty * (line.rate ?? 0) * (1 - (line.discount_percent ?? 0) / 100);
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
      invoice_date: dateToUtcIso(formData.invoice_date),
      lines: formData.lines.map((line) => ({
        ...line,
        unit: line.unit || null,
        conversion_factor: line.conversion_factor ?? 1,
        batch_id: line.batch_id || null,
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
            onClick={() => navigate('/purchase/invoices')}
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}
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
                <SlideSelect
                  name="party_id"
                  label="Vendor"
                  placeholder="Select vendor"
                  panelTitle="Select Vendor"
                  options={vendorOptions}
                  value={watch('party_id')}
                  onChange={(val) => setValue('party_id', val, { shouldValidate: true })}
                  error={errors.party_id?.message}
                  onAddNew={() => setShowAddVendor(true)}
                  addNewLabel="Add New Vendor"
                />
                <Input
                  id="invoice_date"
                  label="Invoice Date"
                  type="date"
                  error={errors.invoice_date?.message}
                  {...register('invoice_date')}
                />
                <Input id="vendor_invoice_number" label="Vendor Invoice #" {...register('vendor_invoice_number')} />
                <Input id="due_date" label="Due Date" type="date" {...register('due_date')} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_inter_state" {...register('is_inter_state')} className="rounded" />
                <label htmlFor="is_inter_state" className="text-sm text-gray-700 dark:text-gray-300">
                  Inter-state purchase (IGST instead of CGST+SGST)
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
                    <div className="col-span-2">Unit</div>
                    <div className="col-span-2">Rate/Base (₹)</div>
                    <div className="col-span-1">Disc %</div>
                    <div className="col-span-1 text-right">Taxable</div>
                  </div>

                  {fields.map((field, index) => {
                    const selectedItemIds = new Set((watchedLines ?? []).filter((_, i) => i !== index).map((l) => l.item_id).filter(Boolean));
                    const filteredItemOptions = itemOptions.filter((o) => !selectedItemIds.has(o.value));
                    const lineItemId = watchedLines?.[index]?.item_id ?? '';
                    const lineItem = itemMap.get(lineItemId);
                    const isBatchTracked = lineItem?.is_batch_tracked ?? false;
                    const lineBatches = batchesCache[lineItemId] ?? [];
                    const batchOptions = lineBatches.map((b) => ({
                      value: b.id,
                      label: b.batch_number,
                      subtitle: b.expiry_date ? `Exp: ${formatDate(b.expiry_date)}` : 'No expiry',
                    }));
                    const selectedBatchId = watch(`lines.${index}.batch_id`) ?? '';
                    const selectedBatch = lineBatches.find((b) => b.id === selectedBatchId);

                    // Build unit options for this line: base unit + alternate units
                    const baseUnitOption = lineItem
                      ? { value: lineItem.unit, label: `${lineItem.unit} (base)`, factor: 1 }
                      : null;
                    const altUnitOptions = (lineItem?.alternate_units ?? []).map((au) => ({
                      value: au.unit,
                      label: `${au.unit} (×${au.conversion_factor})`,
                      factor: au.conversion_factor,
                    }));
                    const allUnitOptions = baseUnitOption ? [baseUnitOption, ...altUnitOptions] : [];
                    const currentLineUnit = watch(`lines.${index}.unit`);

                    return (
                    <div key={field.id} className="space-y-2">
                      <div className="grid grid-cols-12 items-start gap-2">
                        {/* Item */}
                        <div className="col-span-3">
                          <SlideSelect name={`lines.${index}.item_id`} placeholder="Select item" panelTitle="Select Item" options={filteredItemOptions} value={watch(`lines.${index}.item_id`)} onChange={(val) => handleItemSelect(index, val)} />
                        </div>
                        {/* Godown */}
                        <div className="col-span-2">
                          <SlideSelect name={`lines.${index}.godown_id`} placeholder="Select godown" panelTitle="Select Godown" options={godownOptions} value={watch(`lines.${index}.godown_id`)} onChange={(val) => setValue(`lines.${index}.godown_id`, val, { shouldValidate: true })} />
                        </div>
                        {/* Qty */}
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            {...register(`lines.${index}.quantity`)}
                          />
                        </div>
                        {/* Unit selector */}
                        <div className="col-span-2">
                          {allUnitOptions.length > 0 ? (
                            <SlideSelect
                              name={`lines.${index}.unit`}
                              placeholder="Unit"
                              panelTitle="Select Unit"
                              options={allUnitOptions}
                              value={currentLineUnit ?? lineItem?.unit ?? ''}
                              onChange={(val) => {
                                const selected = allUnitOptions.find((o) => o.value === val);
                                setValue(`lines.${index}.unit`, val, { shouldDirty: true });
                                setValue(`lines.${index}.conversion_factor`, selected?.factor ?? 1, { shouldDirty: true });
                              }}
                            />
                          ) : (
                            <div className="flex items-center h-9 px-2 text-xs text-gray-400">—</div>
                          )}
                        </div>
                        {/* Rate per base unit */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="0.00"
                            {...register(`lines.${index}.rate`)}
                          />
                        </div>
                        {/* Discount */}
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                            {...register(`lines.${index}.discount_percent`)}
                          />
                        </div>
                        {/* Taxable + remove */}
                        <div className="col-span-1 flex items-center gap-1">
                          <span className="flex-1 text-right text-sm font-medium py-2">
                            {formatCurrency(calcLineTaxable(watchedLines?.[index] ?? { item_id: '', godown_id: '', quantity: 0, conversion_factor: 1, rate: 0, discount_percent: 0, gst_rate: 0 }))}
                          </span>
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0">
                              <X className="h-4 w-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Batch selection row — only for batch-tracked items */}
                      {isBatchTracked && (
                        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
                          <PackageOpen className="h-4 w-4 shrink-0 text-blue-500" />
                          <div className="flex flex-1 items-center gap-3">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">Batch:</span>
                            <div className="w-56">
                              <SlideSelect
                                name={`lines.${index}.batch_id`}
                                placeholder={lineBatches.length ? 'Select batch' : 'No batches yet'}
                                panelTitle="Select Batch"
                                options={batchOptions}
                                value={selectedBatchId}
                                onChange={(val) => setValue(`lines.${index}.batch_id`, val, { shouldDirty: true })}
                                onAddNew={() => setAddBatchForItem({ itemId: lineItemId, itemName: lineItem?.name ?? '' })}
                                addNewLabel="Add New Batch"
                              />
                            </div>
                            {selectedBatch && (
                              <div className="flex items-center gap-3 text-xs text-blue-700 dark:text-blue-400">
                                {selectedBatch.expiry_date && (
                                  <span>Exp: <strong>{formatDate(selectedBatch.expiry_date)}</strong></span>
                                )}
                                {selectedBatch.current_stock !== undefined && (
                                  <span>Stock: <strong>{parseFloat(Number(selectedBatch.current_stock).toFixed(3))} {lineItem?.unit ?? ''}</strong></span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {getLineGSTInfo(index) && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 pl-1 flex justify-between items-center">
                          <span>{getLineGSTInfo(index)}</span>
                          {getLineAvailableQty(index) && <span className="text-right bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-blue-900 dark:text-blue-200 font-semibold">Available: {getLineAvailableQty(index)}</span>}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>

                {/* GST Totals */}
                <div className="mt-4 border-t dark:border-gray-700 pt-3 space-y-1 text-sm text-right">
                  <div><span className="text-gray-500">Taxable: </span><span className="font-medium">{formatCurrency(totals.taxable)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>CGST: </span><span className={`font-medium ${isInterState ? 'text-gray-400' : ''}`}>{formatCurrency(totals.cgst)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>SGST: </span><span className={`font-medium ${isInterState ? 'text-gray-400' : ''}`}>{formatCurrency(totals.sgst)}</span></div>
                  <div><span className={isInterState ? 'text-gray-500' : 'text-gray-400'}>IGST: </span><span className={`font-medium ${isInterState ? '' : 'text-gray-400'}`}>{formatCurrency(totals.igst)}</span></div>
                  <div className="text-base"><span className="text-gray-500 dark:text-gray-400">Grand Total: </span><span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totals.grand)}</span></div>
                </div>
              </div>

              <Input id="notes" label="Notes" {...register('notes')} />

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={() => navigate('/purchase/invoices')}>Cancel</Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditMode ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <PartyFormModal
        open={showAddVendor}
        onClose={() => setShowAddVendor(false)}
        defaultType="vendor"
        onCreated={(party) => {
          queryClient.invalidateQueries({ queryKey: ['parties-vendors'] });
          setValue('party_id', party.id, { shouldValidate: true });
        }}
      />

      <BatchFormModal
        open={Boolean(addBatchForItem)}
        onClose={() => setAddBatchForItem(null)}
        itemId={addBatchForItem?.itemId ?? ''}
        itemName={addBatchForItem?.itemName}
        onCreated={(batch) => {
          if (!addBatchForItem) return;
          refreshBatches(addBatchForItem.itemId);
          const lineIndex = (watchedLines ?? []).findIndex((l) => l.item_id === addBatchForItem.itemId);
          if (lineIndex >= 0) setValue(`lines.${lineIndex}.batch_id`, batch.id, { shouldDirty: true });
          setAddBatchForItem(null);
        }}
      />
    </div>
  );
}
