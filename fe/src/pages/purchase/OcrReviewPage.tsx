import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useFYStore } from '@/store/fyStore';
import { partiesApi } from '@/api/parties';
import { itemsApi, godownsApi, unitsApi } from '@/api/inventory';
import { purchaseInvoicesApi } from '@/api/purchase';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { OcrScanResponse, OcrExtractedItem } from '@/api/ocr';
import type { Item, Party, Godown } from '@/types';

// ─── Fuzzy match helper ──────────────────────────────────────────────────────
function fuzzyScore(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Create Item Dialog ──────────────────────────────────────────────────────
const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hsn_code: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  purchase_price: z.coerce.number().min(0, 'Must be ≥ 0'),
  selling_price: z.coerce.number().min(0, 'Must be ≥ 0'),
  igst: z.coerce.number().min(0).max(100).default(0),
});
type CreateItemForm = z.infer<typeof createItemSchema>;

interface CreateItemDialogProps {
  open: boolean;
  onClose: () => void;
  ocrItem: OcrExtractedItem;
  onCreated: (item: Item) => void;
}

function CreateItemDialog({ open, onClose, ocrItem, onCreated }: CreateItemDialogProps) {
  const { data: unitsData } = useQuery({
    queryKey: ['units-all'],
    queryFn: () => unitsApi.list({ per_page: '200' }),
    select: (res) => res.data.data ?? [],
  });

  const form = useForm<CreateItemForm>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: ocrItem.item_name,
      hsn_code: ocrItem.hsn_code ?? '',
      unit: '',
      purchase_price: ocrItem.rate ?? 0,
      selling_price: 0,
      igst: ocrItem.gst_rate ?? 0,
    },
  });

  // Re-initialize when the ocrItem changes (different line)
  useEffect(() => {
    form.reset({
      name: ocrItem.item_name,
      hsn_code: ocrItem.hsn_code ?? '',
      unit: '',
      purchase_price: ocrItem.rate ?? 0,
      selling_price: 0,
      igst: ocrItem.gst_rate ?? 0,
    });
  }, [ocrItem.item_name]);

  const createMutation = useMutation({
    mutationFn: (data: CreateItemForm) =>
      itemsApi.create({
        name: data.name,
        hsn_code: data.hsn_code || null,
        unit: data.unit,
        purchase_price: data.purchase_price,
        selling_price: data.selling_price,
        igst: data.igst,
        cgst: data.igst / 2,
        sgst: data.igst / 2,
        is_batch_tracked: false,
        is_active: true,
      }),
    onSuccess: (res) => {
      const newItem = res.data.data!;
      toast.success(`Item "${newItem.name}" created`);
      onCreated(newItem);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create item');
    },
  });

  const unitOptions = (unitsData ?? []).map((u: any) => ({
    value: u.value,
    label: u.label,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Create New Item — ${ocrItem.item_name}`}
      size="lg"
    >
      <form
        onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
        className="space-y-4"
      >
        <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          This will create a permanent item master record. Pre-filled from OCR — review before saving.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="item_name"
            label="Item Name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Input
            id="hsn_code"
            label="HSN Code"
            {...form.register('hsn_code')}
          />
          <SlideSelect
            name="unit"
            label="Unit"
            placeholder="Select unit"
            panelTitle="Select Unit"
            options={unitOptions}
            value={form.watch('unit')}
            onChange={(val) => form.setValue('unit', val, { shouldValidate: true })}
            error={form.formState.errors.unit?.message}
          />
          <Input
            id="purchase_price"
            label="Purchase Price (₹)"
            type="number"
            step="0.01"
            error={form.formState.errors.purchase_price?.message}
            {...form.register('purchase_price')}
          />
          <Input
            id="selling_price"
            label="Selling Price (₹)"
            type="number"
            step="0.01"
            error={form.formState.errors.selling_price?.message}
            {...form.register('selling_price')}
          />
          <Input
            id="igst"
            label="GST Rate (%)"
            type="number"
            step="0.01"
            error={form.formState.errors.igst?.message}
            {...form.register('igst')}
          />
        </div>
        <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            Create Item
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Review Page ────────────────────────────────────────────────────────
export default function OcrReviewPage() {
  usePageTitle('Review Scanned Invoice');
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedFYId = useFYStore((state) => state.selectedFY?.id ?? '');

  const ocrResult = (location.state as { ocrResult?: OcrScanResponse } | null)?.ocrResult;

  // Guard: redirect if no OCR result in state
  useEffect(() => {
    if (!ocrResult) {
      toast.error('No OCR result found. Please scan an invoice first.');
      navigate('/purchase/invoices');
    }
  }, []);

  const extracted = ocrResult?.extracted_data;
  const ocrItems: OcrExtractedItem[] = extracted?.items ?? [];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [partyId, setPartyId] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(extracted?.vendor_invoice_number ?? '');
  const [invoiceDate, setInvoiceDate] = useState(extracted?.invoice_date ?? '');
  const [dueDate, setDueDate] = useState(extracted?.due_date ?? '');
  const [isInterState, setIsInterState] = useState(extracted?.is_inter_state ?? false);
  const [notes, setNotes] = useState(extracted?.notes ?? '');

  // Per-line state: item mapping + editable fields
  const [mappedItemIds, setMappedItemIds] = useState<Record<number, string>>({});
  const [lineQuantities, setLineQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(ocrItems.map((it, i) => [i, it.quantity ?? 1]))
  );
  const [lineRates, setLineRates] = useState<Record<number, number>>(() =>
    Object.fromEntries(ocrItems.map((it, i) => [i, it.rate ?? 0]))
  );
  const [lineDiscounts, setLineDiscounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(ocrItems.map((it, i) => [i, it.discount_percent ?? 0]))
  );
  const [lineGstRates, setLineGstRates] = useState<Record<number, number>>(() =>
    Object.fromEntries(ocrItems.map((it, i) => [i, it.gst_rate ?? 18]))
  );

  // UI state
  const [showRaw, setShowRaw] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [autoMatchedParty, setAutoMatchedParty] = useState(false);

  // Create item dialog state
  const [createItemForIndex, setCreateItemForIndex] = useState<number | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: partiesData } = useQuery({
    queryKey: ['parties-vendors'],
    queryFn: () => partiesApi.list({ per_page: '500', type: 'vendor' }),
    select: (res) => res.data.data ?? [],
  });

  const { data: itemsData, refetch: refetchItems } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data.data ?? [],
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '100' }),
    select: (res) => res.data.data ?? [],
  });

  const parties: Party[] = partiesData ?? [];
  const items: Item[] = itemsData ?? [];
  const godowns: Godown[] = godownsData ?? [];

  const defaultGodownId = useMemo(
    () => godowns.find((g) => g.is_default)?.id ?? godowns[0]?.id ?? '',
    [godowns]
  );

  // ── Auto-match vendor & items once data loads ────────────────────────────────
  useEffect(() => {
    if (!extracted?.vendor_name || parties.length === 0) return;
    if (partyId) return; // already matched

    let best = { id: '', score: 0 };
    for (const p of parties) {
      const score = fuzzyScore(extracted.vendor_name, p.name);
      if (score > best.score) best = { id: p.id, score };
    }
    if (best.score >= 0.4) {
      setPartyId(best.id);
      setAutoMatchedParty(true);
    }
  }, [parties, extracted?.vendor_name]);

  useEffect(() => {
    if (items.length === 0) return;

    const newMapped: Record<number, string> = { ...mappedItemIds };
    let changed = false;

    ocrItems.forEach((ocrItem, i) => {
      if (newMapped[i]) return; // already set
      let best = { id: '', score: 0 };
      for (const item of items) {
        const score = fuzzyScore(ocrItem.item_name, item.name);
        if (score > best.score) best = { id: item.id, score };
      }
      if (best.score >= 0.4) {
        newMapped[i] = best.id;
        changed = true;
      }
    });

    if (changed) setMappedItemIds(newMapped);
  }, [items]);

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): string[] {
    const errs: string[] = [];
    if (!partyId) errs.push('Vendor is not matched — select a vendor from the list');
    if (!invoiceDate) errs.push('Invoice date is missing');
    if (!selectedFYId) errs.push('No financial year selected — select a financial year from the top bar');
    if (godowns.length === 0) errs.push('No godown found — create a godown first');
    ocrItems.forEach((item, i) => {
      if (!mappedItemIds[i]) {
        errs.push(`Line ${i + 1} (${item.item_name}): item not matched — select or create an item`);
      }
    });
    return errs;
  }

  // ── Create Invoice ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => {
      const payload = {
        party_id: partyId,
        financial_year_id: selectedFYId,
        vendor_invoice_number: vendorInvoiceNumber || undefined,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        is_inter_state: isInterState,
        notes: notes || undefined,
        lines: ocrItems.map((item, i) => ({
          item_id: mappedItemIds[i],
          quantity: lineQuantities[i] ?? item.quantity,
          rate: lineRates[i] ?? item.rate,
          discount_percent: lineDiscounts[i] ?? item.discount_percent ?? 0,
          gst_rate: lineGstRates[i] ?? item.gst_rate ?? 18,
          godown_id: defaultGodownId || undefined,
        })),
      };
      return purchaseInvoicesApi.create(payload);
    },
    onSuccess: () => {
      toast.success('Purchase invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      navigate('/purchase/invoices');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create invoice');
    },
  });

  const handleCreateInvoice = () => {
    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationErrors([]);
    createMutation.mutate();
  };

  // Handle item created inline
  const handleItemCreated = (newItem: Item, lineIndex: number) => {
    refetchItems();
    setMappedItemIds((prev) => ({ ...prev, [lineIndex]: newItem.id }));
    // Update rate and gst from the new item
    setLineRates((prev) => ({ ...prev, [lineIndex]: Number(newItem.purchase_price ?? 0) }));
    setLineGstRates((prev) => ({ ...prev, [lineIndex]: Number(newItem.igst ?? 0) }));
    setCreateItemForIndex(null);
  };

  if (!ocrResult || !extracted) return null;

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }));
  const itemOptions = items.map((it) => ({ value: it.id, label: it.name }));

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/purchase/invoices')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Review Scanned Invoice
          </h1>
        </div>
        <Button
          onClick={handleCreateInvoice}
          loading={createMutation.isPending}
          disabled={ocrItems.length === 0}
        >
          Create Invoice
        </Button>
      </div>

      {/* Partial / warnings banner */}
      {(ocrResult.status === 'partial' || (extracted.warnings?.length > 0)) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {ocrResult.status === 'partial'
                  ? 'Some fields could not be extracted — review carefully before importing'
                  : 'AI flagged some uncertain fields'}
              </p>
              {extracted.warnings?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {extracted.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      • {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-300">
            Please fix the following before creating the invoice:
          </p>
          <ul className="space-y-1">
            {validationErrors.map((e, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-400">
                • {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vendor */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vendor</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {extracted.vendor_name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">OCR detected:</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {extracted.vendor_name}
              </span>
              {extracted.vendor_gstin && (
                <Badge variant="default">{extracted.vendor_gstin}</Badge>
              )}
            </div>
          )}
          <div className={partyId ? '' : 'ring-2 ring-amber-400 rounded-lg'}>
            <SlideSelect
              name="party_id"
              label="Match to Vendor"
              placeholder="Select vendor"
              panelTitle="Select Vendor"
              options={partyOptions}
              value={partyId}
              onChange={setPartyId}
              error={!partyId && validationErrors.length > 0 ? 'Vendor is required' : undefined}
            />
          </div>
          {autoMatchedParty && partyId && (
            <p className="text-xs text-green-600 dark:text-green-400">
              ✓ Auto-matched from OCR
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Invoice Details</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="vendor_invoice_number"
              label="Vendor Invoice Number"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
            />
            <Input
              id="invoice_date"
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              error={!invoiceDate && validationErrors.length > 0 ? 'Date is required' : undefined}
            />
            <Input
              id="due_date"
              label="Due Date (optional)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex items-center gap-3 pt-6">
              <input
                id="is_inter_state"
                type="checkbox"
                checked={isInterState}
                onChange={(e) => setIsInterState(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="is_inter_state" className="text-sm text-gray-700 dark:text-gray-300">
                Inter-state supply (IGST)
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Line Items</h3>
        </CardHeader>
        <CardContent>
          {ocrItems.length === 0 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No line items were extracted from the invoice. Go back and re-scan with a clearer image.
            </p>
          ) : (
            <div className="space-y-4">
              {ocrItems.map((ocrItem, i) => {
                const isResolved = Boolean(mappedItemIds[i]);
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 ${
                      isResolved
                        ? 'border-gray-200 dark:border-gray-700'
                        : 'border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/10'
                    }`}
                  >
                    {/* OCR item name */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">OCR:</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {ocrItem.item_name}
                      </span>
                      {ocrItem.hsn_code && (
                        <span className="text-xs text-gray-400">HSN: {ocrItem.hsn_code}</span>
                      )}
                    </div>

                    {/* Item mapping */}
                    <div className="mb-3">
                      <SlideSelect
                        name={`item_${i}`}
                        label="Match to Item"
                        placeholder="Select item from system"
                        panelTitle="Select Item"
                        options={itemOptions}
                        value={mappedItemIds[i] ?? ''}
                        onChange={(val) =>
                          setMappedItemIds((prev) => ({ ...prev, [i]: val }))
                        }
                      />
                      {!isResolved && (
                        <button
                          type="button"
                          onClick={() => setCreateItemForIndex(i)}
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Plus className="h-3 w-3" />
                          Create new item "{ocrItem.item_name}"
                        </button>
                      )}
                    </div>

                    {/* Editable line fields */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Input
                        id={`qty_${i}`}
                        label="Qty"
                        type="number"
                        step="0.001"
                        value={lineQuantities[i] ?? ''}
                        onChange={(e) =>
                          setLineQuantities((prev) => ({ ...prev, [i]: Number(e.target.value) }))
                        }
                      />
                      <Input
                        id={`rate_${i}`}
                        label="Rate (₹)"
                        type="number"
                        step="0.01"
                        value={lineRates[i] ?? ''}
                        onChange={(e) =>
                          setLineRates((prev) => ({ ...prev, [i]: Number(e.target.value) }))
                        }
                      />
                      <Input
                        id={`discount_${i}`}
                        label="Discount %"
                        type="number"
                        step="0.01"
                        value={lineDiscounts[i] ?? ''}
                        onChange={(e) =>
                          setLineDiscounts((prev) => ({ ...prev, [i]: Number(e.target.value) }))
                        }
                      />
                      <Input
                        id={`gst_${i}`}
                        label="GST %"
                        type="number"
                        step="0.01"
                        value={lineGstRates[i] ?? ''}
                        onChange={(e) =>
                          setLineGstRates((prev) => ({ ...prev, [i]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional notes…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </CardContent>
      </Card>

      {/* Raw OCR toggle */}
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        View Raw OCR Response
      </button>
      {showRaw && (
        <pre className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {JSON.stringify(extracted, null, 2)}
        </pre>
      )}

      {/* Sticky footer */}
      <div className="flex justify-end">
        <Button
          onClick={handleCreateInvoice}
          loading={createMutation.isPending}
          disabled={ocrItems.length === 0}
        >
          Create Invoice
        </Button>
      </div>

      {/* Create Item Dialog */}
      {createItemForIndex !== null && (
        <CreateItemDialog
          open={createItemForIndex !== null}
          onClose={() => setCreateItemForIndex(null)}
          ocrItem={ocrItems[createItemForIndex]}
          onCreated={(item) => handleItemCreated(item, createItemForIndex)}
        />
      )}
    </div>
  );
}
