import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFYBounds } from "@/hooks/useFinancialYear";
import { useDateStore } from "@/store/dateStore";
import { partiesApi } from "@/api/parties";
import { itemsApi, stockLedgerApi } from "@/api/inventory";
import { salesOrdersApi } from "@/api/sales";
import { formatCurrency, calcGST } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SlideSelect } from "@/components/ui/SlideSelect";
import { PartyFormModal } from "@/components/ui/PartyFormModal";
import { Plus, ArrowLeft, X } from "lucide-react";
import toast from "react-hot-toast";

const lineSchema = z.object({
  item_id: z.string().min(1, "Item required"),
  quantity: z.coerce.number().min(1, "Min 1"),
  rate: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  gst_rate: z.coerce.number().min(0).optional().default(18),
});

const soSchema = z.object({
  so_number: z.string().optional(),
  party_id: z.string().min(1, "Customer is required"),
  so_date: z.string().min(1, "Date is required"),
  expected_delivery_date: z.string().optional(),
  is_inter_state: z.boolean().optional().default(false),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, "Add at least one item"),
});

type SoForm = z.infer<typeof soSchema>;

const makeEmptyLine = (): SoForm["lines"][number] => ({
  item_id: "",
  quantity: 1,
  rate: 0,
  discount_percent: 0,
  gst_rate: 18,
});

export default function SalesOrderFormPage() {
  usePageTitle("Sales Order");
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const isEditMode = Boolean(orderId);
  const queryClient = useQueryClient();
  const { selectedDate } = useDateStore();
  const fyBounds = useFYBounds();
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const validatedSchema = useMemo(() => {
    if (!fyBounds) return soSchema;
    return soSchema.superRefine((data, ctx) => {
      if (data.so_date && (data.so_date < fyBounds.start || data.so_date > fyBounds.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Date must be within FY ${fyBounds.label}`, path: ["so_date"] });
      }
    });
  }, [fyBounds?.start, fyBounds?.end, fyBounds?.label]);

  const { data: customersData } = useQuery({
    queryKey: ["parties-customers"],
    queryFn: () => partiesApi.list({ per_page: "500", type: "customer" }),
    select: (res) => res.data,
  });

  const { data: itemsData } = useQuery({
    queryKey: ["items-all"],
    queryFn: () => itemsApi.list({ per_page: "500" }),
    select: (res) => res.data,
  });

  const { data: stockSummaryData } = useQuery({
    queryKey: ['stock-summary-all'],
    queryFn: () => stockLedgerApi.summary({ per_page: '999' }),
    select: (res) => res.data,
  });

  const { data: existingSO } = useQuery({
    queryKey: ["sales-order", orderId],
    queryFn: () => salesOrdersApi.get(orderId!),
    enabled: isEditMode,
    select: (res) => res.data.data,
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
  } = useForm<SoForm>({
    resolver: zodResolver(validatedSchema) as any,
    defaultValues: {
      so_number: "",
      party_id: "",
      so_date: selectedDate,
      expected_delivery_date: selectedDate,
      is_inter_state: false,
      notes: "",
      lines: [makeEmptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const isInterState = watch("is_inter_state");

  useEffect(() => {
    if (existingSO) {
      reset({
        so_number: existingSO.so_number ?? "",
        party_id: existingSO.party_id,
        so_date: existingSO.so_date,
        expected_delivery_date: existingSO.expected_delivery_date ?? "",
        is_inter_state: (existingSO as any).is_inter_state ?? false,
        notes: existingSO.notes ?? "",
        lines: existingSO.lines?.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
          rate: l.rate,
          discount_percent: l.discount_percent,
          gst_rate: l.gst_rate,
        })) ?? [makeEmptyLine()],
      });
    }
  }, [existingSO, reset]);

  const itemMap = useMemo(
    () => new Map((itemsData?.data ?? []).map((i) => [i.id, i])),
    [itemsData?.data]
  );

  const stockByItemMap = useMemo(() => {
    const map = new Map<string, number>();
    (stockSummaryData?.data ?? []).forEach((row) => {
      map.set(row.item_id, (map.get(row.item_id) ?? 0) + (row.current_stock ?? 0));
    });
    return map;
  }, [stockSummaryData?.data]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => salesOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Sales order created");
      navigate("/sales/orders");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      salesOrdersApi.update(orderId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order", orderId] });
      toast.success("Sales order updated");
      navigate("/sales/orders");
    },
  });

  const onSubmit = (formData: SoForm) => {
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
      const defaultAu = (item.alternate_units ?? []).find((au) => au.is_default_sale);
      const rate = defaultAu?.selling_price != null
        ? Number(defaultAu.selling_price)
        : Number(item.selling_price ?? 0);
      setValue(`lines.${index}.rate`, rate, { shouldDirty: true });
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

  const getLineAvailableQty = (lineIndex: number) => {
    const line = watchedLines?.[lineIndex];
    if (!line?.item_id) return null;
    const qty = stockByItemMap.get(line.item_id) ?? 0;
    const item = itemMap.get(line.item_id);
    const baseUnit = item?.unit ?? '';
    return `${qty} ${baseUnit} (stock)`;
  };

  const customerOptions = (customersData?.data ?? []).map((p) => ({
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
          onClick={() => navigate("/sales/orders")}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEditMode ? "Edit Sales Order" : "New Sales Order"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Header fields */}
        <Card>
          <CardHeader><span className="font-semibold text-gray-700 dark:text-gray-200">Order Details</span></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                id="so_number"
                label="SO Number"
                placeholder="Auto-generated if empty"
                error={errors.so_number?.message}
                {...register("so_number")}
              />
              <SlideSelect
                name="party_id"
                label="Customer *"
                placeholder="Select customer"
                panelTitle="Select Customer"
                options={customerOptions}
                value={watch("party_id")}
                onChange={(val) =>
                  setValue("party_id", val, { shouldValidate: true })
                }
                error={errors.party_id?.message}
                onAddNew={() => setShowAddCustomer(true)}
                addNewLabel="Add New Customer"
              />
              <Input
                id="so_date"
                label="SO Date *"
                type="date"
                error={errors.so_date?.message}
                {...register("so_date")}
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
                      {(() => {
                        const selectedItemIds = new Set(
                          (watchedLines ?? [])
                            .filter((_, i) => i !== index)
                            .map((l) => l.item_id)
                            .filter(Boolean)
                        );
                        const filteredItemOptions = itemOptions.filter((o) => !selectedItemIds.has(o.value));
                        return (
                          <>
                            <SlideSelect
                              name={`lines.${index}.item_id`}
                              placeholder="Select item"
                              panelTitle="Select Item"
                              options={filteredItemOptions}
                              value={watch(`lines.${index}.item_id`)}
                              onChange={(val) => handleItemChange(index, val)}
                            />
                            {errors.lines?.[index]?.item_id && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.lines[index]?.item_id?.message}
                              </p>
                            )}
                          </>
                        );
                      })()}
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
                  {/* Per-line stock + GST info */}
                  <div className="flex items-center justify-between pl-1">
                    {getLineGSTInfo(index) ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getLineGSTInfo(index)}
                      </p>
                    ) : <span />}
                    {getLineAvailableQty(index) && (
                      <span className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-blue-900 dark:text-blue-200 font-semibold text-xs">
                        Available: {getLineAvailableQty(index)}
                      </span>
                    )}
                  </div>
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
            onClick={() => navigate("/sales/orders")}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEditMode ? "Update Order" : "Create Order"}
          </Button>
        </div>
      </form>

      <PartyFormModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        defaultType="customer"
        onCreated={(party) => {
          queryClient.invalidateQueries({ queryKey: ["parties-customers"] });
          setValue("party_id", party.id, { shouldValidate: true });
        }}
      />
    </div>
  );
}
