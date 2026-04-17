import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useDateStore } from "@/store/dateStore";
import { partiesApi } from "@/api/parties";
import { itemsApi } from "@/api/inventory";
import { purchaseOrdersApi } from "@/api/purchase";
import { formatCurrency, calcGST } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SlideSelect } from "@/components/ui/SlideSelect";
import { Plus, ArrowLeft, X } from "lucide-react";
import toast from "react-hot-toast";

const lineSchema = z.object({
  item_id: z.string().min(1, "Item required"),
  quantity: z.coerce.number().min(1, "Min 1"),
  rate: z.coerce.number().min(0, "Min 0"),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const poSchema = z.object({
  po_number: z.string().optional(),
  party_id: z.string().min(1, "Vendor is required"),
  po_date: z.string().min(1, "Date is required"),
  expected_delivery_date: z.string().optional(),
  is_inter_state: z.boolean().optional().default(false),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, "Add at least one item"),
});

type PoForm = z.infer<typeof poSchema>;

const makeEmptyLine = (): PoForm["lines"][number] => ({
  item_id: "",
  quantity: 1,
  rate: 0,
  discount_percent: 0,
  gst_rate: 18,
});

export default function PurchaseOrderFormPage() {
  usePageTitle("Purchase Order");
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const isEditMode = Boolean(orderId);
  const queryClient = useQueryClient();
  const { selectedDate } = useDateStore();

  const { data: vendorsData } = useQuery({
    queryKey: ["parties-vendors"],
    queryFn: () => partiesApi.list({ per_page: "500", type: "vendor" }),
    select: (res) => res.data,
  });

  const { data: itemsData } = useQuery({
    queryKey: ["items-all"],
    queryFn: () => itemsApi.list({ per_page: "500" }),
    select: (res) => res.data,
  });

  const { data: existingPO } = useQuery({
    queryKey: ["purchase-order", orderId],
    queryFn: () => purchaseOrdersApi.get(orderId!),
    enabled: isEditMode,
    select: (res) => res.data,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PoForm>({
    resolver: zodResolver(poSchema) as any,
    defaultValues: {
      po_number: "",
      party_id: "",
      po_date: selectedDate,
      expected_delivery_date: "",
      is_inter_state: false,
      notes: "",
      lines: [makeEmptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const isInterState = watch("is_inter_state");

  useEffect(() => {
    if (existingPO) {
      reset({
        po_number: existingPO.po_number ?? "",
        party_id: existingPO.party_id,
        po_date: existingPO.po_date,
        expected_delivery_date: existingPO.expected_delivery_date ?? "",
        is_inter_state: (existingPO as any).is_inter_state ?? false,
        notes: existingPO.notes ?? "",
        lines: existingPO.lines?.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
          rate: l.rate,
          discount_percent: l.discount_percent,
          gst_rate: l.gst_rate,
        })) ?? [makeEmptyLine()],
      });
    }
  }, [existingPO, reset]);

  const itemMap = useMemo(
    () => new Map((itemsData?.data ?? []).map((i) => [i.id, i])),
    [itemsData?.data]
  );

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      purchaseOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order created");
      navigate("/purchase/orders");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      purchaseOrdersApi.update(orderId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", orderId] });
      toast.success("Purchase order updated");
      navigate("/purchase/orders");
    },
  });

  const onSubmit = (formData: PoForm) => {
    const payload = { ...formData } as Record<string, unknown>;
    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleItemChange = (index: number, itemId: string) => {
    setValue(`lines.${index}.item_id`, itemId, { shouldDirty: true });
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`lines.${index}.rate`, item.purchase_price ?? 0, { shouldDirty: true });
      const currentIsInterState = watch("is_inter_state");
      const igst = item.igst ?? 0;
      const sgst = item.sgst ?? 0;
      const cgst = item.cgst ?? 0;
      const gstRate = currentIsInterState
        ? (igst > 0 ? igst : 18)
        : ((sgst + cgst) > 0 ? (sgst + cgst) : 18);
      setValue(`lines.${index}.gst_rate`, gstRate, { shouldDirty: true, shouldValidate: true });
    }
  };

  const totals = (watchedLines ?? []).reduce(
    (acc, line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const disc = Number(line.discount_percent) || 0;
      const gstRate = Number(line.gst_rate) || 0;
      const taxable = qty * rate * (1 - disc / 100);
      const gst = calcGST(taxable, gstRate, isInterState ?? false);
      return {
        taxable: acc.taxable + taxable,
        cgst: acc.cgst + gst.cgst,
        sgst: acc.sgst + gst.sgst,
        igst: acc.igst + gst.igst,
        grand: acc.grand + taxable + gst.cgst + gst.sgst + gst.igst,
      };
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 },
  );

  const getLineGSTInfo = (index: number) => {
    const line = watchedLines?.[index];
    if (!line?.item_id || !line?.rate) return null;
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const disc = Number(line.discount_percent) || 0;
    const gstRate = Number(line.gst_rate) || 0;
    const taxable = qty * rate * (1 - disc / 100);
    const gst = calcGST(taxable, gstRate, isInterState ?? false);
    if (isInterState) {
      return `IGST ${gstRate}% = ${formatCurrency(gst.igst)}`;
    }
    return `CGST ${gstRate / 2}% = ${formatCurrency(gst.cgst)} · SGST ${gstRate / 2}% = ${formatCurrency(gst.sgst)}`;
  };

  const vendorOptions = (vendorsData?.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    subtitle: p.type ?? "",
  }));

  const itemOptions = (itemsData?.data ?? []).map((i) => ({
    value: i.id,
    label: i.name,
    subtitle: i.sku ?? i.hsn_code ?? "",
  }));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/purchase/orders")}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEditMode ? "Edit Purchase Order" : "New Purchase Order"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Header fields */}
        <Card>
          <CardHeader title="Order Details" />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                id="po_number"
                label="PO Number"
                placeholder="Auto-generated if empty"
                error={errors.po_number?.message}
                {...register("po_number")}
              />
              <SlideSelect
                name="party_id"
                label="Vendor *"
                placeholder="Select vendor"
                panelTitle="Select Vendor"
                options={vendorOptions}
                value={watch("party_id")}
                onChange={(val) =>
                  setValue("party_id", val, { shouldValidate: true })
                }
                error={errors.party_id?.message}
              />
              <Input
                id="po_date"
                label="PO Date *"
                type="date"
                error={errors.po_date?.message}
                {...register("po_date")}
              />
              <Input
                id="expected_delivery_date"
                label="Expected Delivery"
                type="date"
                {...register("expected_delivery_date")}
              />
              <div className="sm:col-span-2">
                <Input
                  id="notes"
                  label="Notes"
                  placeholder="Optional notes..."
                  {...register("notes")}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_inter_state"
                  {...register("is_inter_state")}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label
                  htmlFor="is_inter_state"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Inter-state supply (IGST)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Line Items
            </h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append(makeEmptyLine())}
            >
              <Plus className="mr-1 h-3 w-3" /> Add Line
            </Button>
          </div>
          <CardContent>
            {errors.lines?.message && (
              <p className="mb-3 text-sm text-red-500">
                {errors.lines.message}
              </p>
            )}

            {/* Column headers */}
            <div className="mb-2 grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              <div className="col-span-4">Item</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Rate (₹)</div>
              <div className="col-span-1">Disc %</div>
              <div className="col-span-1">GST %</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                      <SlideSelect
                        name={`lines.${index}.item_id`}
                        placeholder="Select item"
                        panelTitle="Select Item"
                        options={itemOptions}
                        value={watch(`lines.${index}.item_id`)}
                        onChange={(val) => handleItemChange(index, val)}
                      />
                      {errors.lines?.[index]?.item_id && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.lines[index]?.item_id?.message}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        {...register(`lines.${index}.quantity`)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        {...register(`lines.${index}.rate`)}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        {...register(`lines.${index}.discount_percent`)}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        {...register(`lines.${index}.gst_rate`)}
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-end py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {(() => {
                        const l = watchedLines?.[index] ?? makeEmptyLine();
                        const qty = Number(l.quantity) || 0;
                        const rate = Number(l.rate) || 0;
                        const disc = Number(l.discount_percent) || 0;
                        const gstRate = Number(l.gst_rate) || 0;
                        const taxable = qty * rate * (1 - disc / 100);
                        const gst = calcGST(
                          taxable,
                          gstRate,
                          isInterState ?? false,
                        );
                        return formatCurrency(
                          taxable + gst.cgst + gst.sgst + gst.igst,
                        );
                      })()}
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Per-line GST info */}
                  {getLineGSTInfo(index) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                      {getLineGSTInfo(index)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* GST Totals */}
            <div className="mt-4 border-t dark:border-gray-700 pt-3 space-y-1 text-sm text-right">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Taxable:{" "}
                </span>
                <span className="font-medium">
                  {formatCurrency(totals.taxable)}
                </span>
              </div>
              <div>
                <span
                  className={
                    isInterState
                      ? "text-gray-400 dark:text-gray-600"
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  CGST:{" "}
                </span>
                <span
                  className={`font-medium ${isInterState ? "text-gray-400 dark:text-gray-600" : ""}`}
                >
                  {formatCurrency(totals.cgst)}
                </span>
              </div>
              <div>
                <span
                  className={
                    isInterState
                      ? "text-gray-400 dark:text-gray-600"
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  SGST:{" "}
                </span>
                <span
                  className={`font-medium ${isInterState ? "text-gray-400 dark:text-gray-600" : ""}`}
                >
                  {formatCurrency(totals.sgst)}
                </span>
              </div>
              <div>
                <span
                  className={
                    !isInterState
                      ? "text-gray-400 dark:text-gray-600"
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  IGST:{" "}
                </span>
                <span
                  className={`font-medium ${!isInterState ? "text-gray-400 dark:text-gray-600" : ""}`}
                >
                  {formatCurrency(totals.igst)}
                </span>
              </div>
              <div className="pt-1 border-t dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">
                  Grand Total:{" "}
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totals.grand)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/purchase/orders")}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEditMode ? "Update Order" : "Create Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
