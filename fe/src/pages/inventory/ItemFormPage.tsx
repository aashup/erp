import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { itemsApi, itemGroupsApi, unitsApi } from "@/api/inventory";
import type { ItemGroup, Unit } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SlideSelect } from "@/components/ui/SlideSelect";
import { ItemGroupFormModal } from "@/components/ui/ItemGroupFormModal";
import { ArrowLeft, Plus, X, Info } from "lucide-react";

const alternateUnitSchema = z.object({
  unit: z.string().min(1, "Unit required"),
  conversion_factor: z.coerce.number().min(0.0001, "Must be > 0"),
  selling_price: z.coerce.number().nullable().optional(),
  is_default_purchase: z.boolean().optional().default(false),
  is_default_sale: z.boolean().optional().default(false),
});

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  hsn_code: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  item_group_id: z.string().optional(),
  igst: z.coerce.number().min(0),
  sgst: z.coerce.number().min(0),
  cgst: z.coerce.number().min(0),
  mrp: z
    .union([z.coerce.number(), z.nan()])
    .transform((val) => (isNaN(val) ? undefined : val))
    .optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  selling_price: z.coerce.number().min(0).optional(),
  reorder_level: z.coerce.number().int().min(0).optional(),
  is_batch_tracked: z.boolean().optional(),
  alternate_units: z.array(alternateUnitSchema).optional().default([]),
});

type ItemForm = z.infer<typeof itemSchema>;

export default function ItemFormPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const isEdit = !!itemId;
  usePageTitle(isEdit ? "Edit Item" : "New Item");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddGroup, setShowAddGroup] = useState(false);

  const { data: unitsData, isLoading: isUnitsLoading } = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsApi.list({ per_page: "500", status: "active" }),
    select: (res) => res.data,
  });

  const { data: itemGroupsData } = useQuery({
    queryKey: ["item-groups"],
    queryFn: () => itemGroupsApi.list({ per_page: "500", active_only: "1" }),
    select: (res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.data || []) as ItemGroup[];
    },
  });

  const { data: itemData, isLoading: isItemLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.get(itemId!),
    select: (res) => res.data.data,
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema) as any,
    defaultValues: {
      igst: 18,
      sgst: 9,
      cgst: 9,
      reorder_level: 0,
      alternate_units: [],
    },
  });

  const {
    fields: auFields,
    append: appendAu,
    remove: removeAu,
  } = useFieldArray({ control, name: "alternate_units" });

  const igstValue = watch("igst");
  const isBatchTracked = watch("is_batch_tracked");
  const currentBaseUnit = watch("unit");

  useEffect(() => {
    setValue("sgst", Number((igstValue / 2).toFixed(2)), { shouldDirty: false });
    setValue("cgst", Number((igstValue / 2).toFixed(2)), { shouldDirty: false });
  }, [igstValue, setValue]);

  useEffect(() => {
    if (itemData) {
      reset({
        name: itemData.name,
        sku: itemData.sku ?? "",
        hsn_code: itemData.hsn_code ?? "",
        unit: itemData.unit,
        item_group_id: itemData.item_group_id ?? "",
        igst: itemData.igst,
        sgst: itemData.sgst,
        cgst: itemData.cgst,
        mrp: itemData.mrp ?? undefined,
        purchase_price: itemData.purchase_price ?? undefined,
        selling_price: itemData.selling_price ?? undefined,
        reorder_level: itemData.reorder_level ?? undefined,
        is_batch_tracked: itemData.is_batch_tracked,
        alternate_units: (itemData.alternate_units ?? []).map((au) => ({
          unit: au.unit,
          conversion_factor: au.conversion_factor,
          selling_price: au.selling_price ?? null,
          is_default_purchase: au.is_default_purchase,
          is_default_sale: au.is_default_sale,
        })),
      });
    }
  }, [itemData, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ItemForm) => itemsApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
      toast.success("Item created");
      navigate("/inventory/items");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ItemForm) => itemsApi.update(itemId!, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      toast.success("Item updated");
      navigate("/inventory/items");
    },
  });

  const unitOptions = (unitsData?.data ?? []).map((unit: Unit) => ({
    value: unit.value,
    label: unit.label,
  }));

  const formUnitOptions =
    isEdit && itemData && !unitOptions.some((u) => u.value === itemData.unit)
      ? [...unitOptions, { value: itemData.unit, label: `${itemData.unit} (current)` }]
      : unitOptions;

  const altUnitOptions = formUnitOptions.filter((u) => u.value !== currentBaseUnit);

  const onSubmit = (formData: ItemForm) => {
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isEdit && isItemLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        Loading item...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/inventory/items")}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? "Edit Item" : "New Item"}
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          {isUnitsLoading ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              Loading item units...
            </div>
          ) : formUnitOptions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              Configure item units in Settings before creating or editing items.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="name"
              label="Name"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              id="sku"
              label="SKU"
              error={errors.sku?.message}
              {...register("sku")}
            />
            <Input id="hsn_code" label="HSN Code" {...register("hsn_code")} />
            <SlideSelect
              name="unit"
              label="Base Unit (Stock Unit)"
              placeholder="Select unit"
              panelTitle="Select Unit"
              options={formUnitOptions}
              value={watch("unit")}
              onChange={(val) => setValue("unit", val, { shouldValidate: true })}
              error={errors.unit?.message}
              disabled={isUnitsLoading || formUnitOptions.length === 0}
            />
            <SlideSelect
              name="item_group_id"
              label="Item Group"
              placeholder="Select group"
              panelTitle="Select Item Group"
              options={(itemGroupsData ?? []).map((g: ItemGroup) => ({
                value: g.id,
                label: g.name,
              }))}
              value={watch("item_group_id")}
              onChange={(val) => setValue("item_group_id", val)}
              onAddNew={() => setShowAddGroup(true)}
              addNewLabel="Add New Group"
            />
            <Input
              id="igst"
              label="IGST (%)"
              type="number"
              step="0.01"
              error={errors.igst?.message}
              {...register("igst", { valueAsNumber: true })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SGST (%){" "}
                <span className="text-xs text-gray-500">(Auto-calculated)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={watch("sgst")}
                disabled
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CGST (%){" "}
                <span className="text-xs text-gray-500">(Auto-calculated)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={watch("cgst")}
                disabled
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <Input
              id="mrp"
              label="MRP"
              type="number"
              step="0.01"
              error={errors.mrp?.message}
              {...register("mrp", { valueAsNumber: true })}
            />
            <Input
              id="purchase_price"
              label="Purchase Price"
              type="number"
              step="0.01"
              error={errors.purchase_price?.message}
              {...register("purchase_price", { valueAsNumber: true })}
            />
            <Input
              id="selling_price"
              label="Selling Price"
              type="number"
              step="0.01"
              error={errors.selling_price?.message}
              {...register("selling_price", { valueAsNumber: true })}
            />
            <Input
              id="reorder_level"
              label="Reorder Level"
              type="number"
              error={errors.reorder_level?.message}
              {...register("reorder_level", { valueAsNumber: true })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_batch_tracked"
              {...register("is_batch_tracked")}
              className="rounded"
            />
            <label
              htmlFor="is_batch_tracked"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Track batches & expiry
            </label>
          </div>

          {isBatchTracked && (
            <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium">Batch tracking enabled</p>
                <p className="mt-0.5 text-blue-700 dark:text-blue-400">
                  During stock entries (purchase, opening stock, adjustments) you'll be required to specify:
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>Batch Number</li>
                  <li>Manufacturing Date</li>
                  <li>Expiry Date</li>
                  <li>Batch-specific pricing (optional)</li>
                </ul>
                {isEdit && (
                  <p className="mt-2 text-blue-600 dark:text-blue-400">
                    After saving, use the <strong>Batches</strong> button in the items list to add and manage batches.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Alternate Units Section */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Alternate Units
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Rate is always per base unit ({currentBaseUnit || "—"}). Alternate units are for entry convenience.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  appendAu({
                    unit: "",
                    conversion_factor: 1,
                    selling_price: null,
                    is_default_purchase: false,
                    is_default_sale: false,
                  })
                }
                disabled={altUnitOptions.length === 0}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Unit
              </Button>
            </div>

            {auFields.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                No alternate units. The base unit ({currentBaseUnit || "—"}) is always available.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-3">Conversion (1 unit = N base)</div>
                  <div className="col-span-2">Selling Price (₹)</div>
                  <div className="col-span-2 text-center">Default Buy</div>
                  <div className="col-span-2 text-center">Default Sell</div>
                  <div className="col-span-1" />
                </div>
                {auFields.map((auField, auIndex) => {
                  const selectedAuUnit = watch(`alternate_units.${auIndex}.unit`);
                  return (
                    <div key={auField.id} className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-2">
                        <SlideSelect
                          name={`alternate_units.${auIndex}.unit`}
                          placeholder="Select unit"
                          panelTitle="Select Unit"
                          options={altUnitOptions}
                          value={watch(`alternate_units.${auIndex}.unit`) ?? ""}
                          onChange={(val) =>
                            setValue(`alternate_units.${auIndex}.unit`, val, { shouldValidate: true })
                          }
                          error={errors.alternate_units?.[auIndex]?.unit?.message}
                        />
                      </div>
                      <div className="col-span-3 flex items-center gap-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          1 {selectedAuUnit || "unit"} =
                        </span>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1.5 text-sm"
                          {...register(`alternate_units.${auIndex}.conversion_factor`, { valueAsNumber: true })}
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {currentBaseUnit || "base"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Optional"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1.5 text-sm"
                          {...register(`alternate_units.${auIndex}.selling_price`, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="checkbox"
                          {...register(`alternate_units.${auIndex}.is_default_purchase`)}
                          className="h-4 w-4 rounded"
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="checkbox"
                          {...register(`alternate_units.${auIndex}.is_default_sale`)}
                          className="h-4 w-4 rounded"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeAu(auIndex)}
                          className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => navigate("/inventory/items")}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={isUnitsLoading || formUnitOptions.length === 0}
            >
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Card>

      <ItemGroupFormModal
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        onCreated={(group) => {
          queryClient.invalidateQueries({ queryKey: ["item-groups"] });
          setValue("item_group_id", group.id);
        }}
      />
    </div>
  );
}
