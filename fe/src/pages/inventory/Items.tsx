import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { itemsApi, itemGroupsApi, unitsApi } from '@/api/inventory';
import type { Item, ItemGroup, Unit } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown, PackageOpen, Info, X } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

const alternateUnitSchema = z.object({
  unit: z.string().min(1, 'Unit required'),
  conversion_factor: z.coerce.number().min(0.0001, 'Must be > 0'),
  is_default_purchase: z.boolean().optional().default(false),
  is_default_sale: z.boolean().optional().default(false),
});

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  hsn_code: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  item_group_id: z.string().optional(),
  igst: z.coerce.number().min(0),
  sgst: z.coerce.number().min(0),
  cgst: z.coerce.number().min(0),
  mrp: z.union([z.coerce.number(), z.nan()]).transform((val) => (isNaN(val) ? undefined : val)).optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  selling_price: z.coerce.number().min(0).optional(),
  reorder_level: z.coerce.number().int().min(0).optional(),
  is_batch_tracked: z.boolean().optional(),
  alternate_units: z.array(alternateUnitSchema).optional().default([]),
});

type ItemForm = z.infer<typeof itemSchema>;

export default function Items() {
  usePageTitle('Items');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('inventory.create');
  const canEdit = hasPermission('inventory.edit');
  const canDelete = hasPermission('inventory.delete');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['items', page, search, skuFilter, groupFilter, statusFilter, unitFilter, sortBy, sortOrder],
    queryFn: () => itemsApi.list({
      page: String(page),
      search,
      per_page: '25',
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(skuFilter ? { sku: skuFilter } : {}),
      ...(groupFilter ? { item_group_id: groupFilter } : {}),
      ...(statusFilter ? { is_active: statusFilter === 'active' ? '1' : '0' } : {}),
      ...(unitFilter ? { unit: unitFilter } : {}),
    }),
    select: (res) => res.data,
  });

  const { data: unitsData, isLoading: isUnitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitsApi.list({ per_page: '500', status: 'active' }),
    select: (res) => res.data,
  });

  const { data: itemGroupsData } = useQuery({
    queryKey: ['item-groups'],
    queryFn: () => itemGroupsApi.list({ per_page: '500', active_only: '1' }),
    select: (res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.data || []) as ItemGroup[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ItemForm) => itemsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ItemForm> }) =>
      itemsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
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
    defaultValues: { igst: 18, sgst: 9, cgst: 9, reorder_level: 0, alternate_units: [] },
  });

  const { fields: auFields, append: appendAu, remove: removeAu } = useFieldArray({
    control,
    name: 'alternate_units',
  });

  const igstValue = watch('igst');
  const isBatchTracked = watch('is_batch_tracked');
  const currentBaseUnit = watch('unit');

  // Auto-calculate SGST and CGST from IGST
  useEffect(() => {
    const sgstValue = igstValue / 2;
    const cgstValue = igstValue / 2;
    setValue('sgst', Number(sgstValue.toFixed(2)), { shouldDirty: false });
    setValue('cgst', Number(cgstValue.toFixed(2)), { shouldDirty: false });
  }, [igstValue, setValue]);

  const openCreate = () => {
    setEditItem(null);
    reset({
      name: '',
      sku: '',
      hsn_code: '',
      unit: unitOptions[0]?.value ?? '',
      item_group_id: (itemGroupsData ?? [])[0]?.id ?? '',
      igst: 18,
      sgst: 9,
      cgst: 9,
      reorder_level: 0,
      is_batch_tracked: false,
      alternate_units: [],
    });
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    reset({
      name: item.name,
      sku: item.sku ?? '',
      hsn_code: item.hsn_code ?? '',
      unit: item.unit,
      item_group_id: item.item_group_id ?? '',
      igst: item.igst,
      sgst: item.sgst,
      cgst: item.cgst,
      mrp: item.mrp ?? undefined,
      purchase_price: item.purchase_price ?? undefined,
      selling_price: item.selling_price ?? undefined,
      reorder_level: item.reorder_level ?? undefined,
      is_batch_tracked: item.is_batch_tracked,
      alternate_units: (item.alternate_units ?? []).map((au) => ({
        unit: au.unit,
        conversion_factor: au.conversion_factor,
        is_default_purchase: au.is_default_purchase,
        is_default_sale: au.is_default_sale,
      })),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    reset();
  };

  const onSubmit = (formData: ItemForm) => {
    if (unitOptions.length === 0) {
      return;
    }

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const unitOptions = (unitsData?.data ?? []).map((unit: Unit) => ({
    value: unit.value,
    label: unit.label,
  }));
  const formUnitOptions =
    editItem && !unitOptions.some((unit) => unit.value === editItem.unit)
      ? [...unitOptions, { value: editItem.unit, label: `${editItem.unit} (current)` }]
      : unitOptions;

  // Unit options for alternate unit dropdowns — excludes current base unit
  const altUnitOptions = formUnitOptions.filter((u) => u.value !== currentBaseUnit);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns: ColumnDef<Item, unknown>[] = [
    {
      id: 'name',
      header: () => (
        <button
          onClick={() => handleSort('name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by name"
        >
          Name
          {renderSortIcon('name')}
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.name}</span>
          {row.original.is_batch_tracked && (
            <Badge variant="info">Batch</Badge>
          )}
        </div>
      ),
    },
    {
      id: 'sku',
      header: () => (
        <button
          onClick={() => handleSort('sku')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by SKU"
        >
          SKU
          {renderSortIcon('sku')}
        </button>
      ),
      accessorKey: 'sku',
    },
    {
      id: 'hsn_code',
      header: () => (
        <button
          onClick={() => handleSort('hsn_code')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by HSN"
        >
          HSN
          {renderSortIcon('hsn_code')}
        </button>
      ),
      accessorKey: 'hsn_code',
    },
    {
      id: 'unit',
      header: () => (
        <button
          onClick={() => handleSort('unit')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by unit"
        >
          Unit
          {renderSortIcon('unit')}
        </button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        const altUnits = item.alternate_units ?? [];
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{item.unit}</span>
            {altUnits.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +{altUnits.map((au) => `${au.unit}(×${au.conversion_factor})`).join(', ')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'group_name',
      header: () => (
        <button
          onClick={() => handleSort('group_name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by group"
        >
          Group
          {renderSortIcon('group_name')}
        </button>
      ),
      cell: ({ row }) => row.original.item_group?.name ?? '—',
    },
    {
      id: 'igst',
      header: () => (
        <button
          onClick={() => handleSort('igst')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by IGST"
        >
          IGST %
          {renderSortIcon('igst')}
        </button>
      ),
      cell: ({ row }) => `${row.original.igst}%`,
    },
    {
      id: 'sgst',
      header: () => (
        <button
          onClick={() => handleSort('sgst')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by SGST"
        >
          SGST %
          {renderSortIcon('sgst')}
        </button>
      ),
      cell: ({ row }) => `${row.original.sgst}%`,
    },
    {
      id: 'cgst',
      header: () => (
        <button
          onClick={() => handleSort('cgst')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by CGST"
        >
          CGST %
          {renderSortIcon('cgst')}
        </button>
      ),
      cell: ({ row }) => `${row.original.cgst}%`,
    },
    {
      id: 'selling_price',
      header: () => (
        <button
          onClick={() => handleSort('selling_price')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by price"
        >
          Price
          {renderSortIcon('selling_price')}
        </button>
      ),
      cell: ({ row }) => {
        const v = row.original.selling_price;
        return v ? formatCurrency(v) : '—';
      },
    },
    {
      id: 'is_active',
      header: () => (
        <button
          onClick={() => handleSort('is_active')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by status"
        >
          Status
          {renderSortIcon('is_active')}
        </button>
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'danger'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: Item } }) => (
        <div className="flex items-center gap-1">
          {row.original.is_batch_tracked && (
            <button
              onClick={() => navigate(`/inventory/items/${row.original.id}/batches`)}
              className="rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              title="Manage Batches"
            >
              <PackageOpen className="h-4 w-4 text-blue-500" />
            </button>
          )}
          {canEdit && (
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this item?')) deleteMutation.mutate(row.original.id);
              }}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    } as ColumnDef<Item, unknown>,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Items</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canCreate && (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={openCreate} disabled={isUnitsLoading || unitOptions.length === 0}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
              {!isUnitsLoading && unitOptions.length === 0 && (
                <span className="text-xs text-red-500">Configure units in Settings first</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && (
          <Pagination
            currentPage={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editItem ? 'Edit Item' : 'New Item'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
            <Input id="sku" label="SKU" error={errors.sku?.message} {...register('sku')} />
            <Input id="hsn_code" label="HSN Code" {...register('hsn_code')} />
            <SlideSelect
              name="unit"
              label="Base Unit (Stock Unit)"
              placeholder="Select unit"
              panelTitle="Select Unit"
              options={formUnitOptions}
              value={watch('unit')}
              onChange={(val) => setValue('unit', val, { shouldValidate: true })}
              error={errors.unit?.message}
              disabled={isUnitsLoading || formUnitOptions.length === 0}
            />
            <SlideSelect
              name="item_group_id"
              label="Item Group"
              placeholder="Select group"
              panelTitle="Select Item Group"
              options={(itemGroupsData ?? []).map((g) => ({ value: g.id, label: g.name }))}
              value={watch('item_group_id')}
              onChange={(val) => setValue('item_group_id', val)}
            />
            <Input id="igst" label="IGST (%)" type="number" step="0.01" error={errors.igst?.message} {...register('igst', { valueAsNumber: true })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SGST (%) <span className="text-xs text-gray-500">(Auto-calculated)</span></label>
              <input type="number" step="0.01" value={watch('sgst')} disabled className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CGST (%) <span className="text-xs text-gray-500">(Auto-calculated)</span></label>
              <input type="number" step="0.01" value={watch('cgst')} disabled className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed" />
            </div>
            <Input id="mrp" label="MRP" type="number" step="0.01" error={errors.mrp?.message} {...register('mrp', { valueAsNumber: true })} />
            <Input id="purchase_price" label="Purchase Price" type="number" step="0.01" error={errors.purchase_price?.message} {...register('purchase_price', { valueAsNumber: true })} />
            <Input id="selling_price" label="Selling Price" type="number" step="0.01" error={errors.selling_price?.message} {...register('selling_price', { valueAsNumber: true })} />
            <Input id="reorder_level" label="Reorder Level" type="number" error={errors.reorder_level?.message} {...register('reorder_level', { valueAsNumber: true })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_batch_tracked" {...register('is_batch_tracked')} className="rounded" />
            <label htmlFor="is_batch_tracked" className="text-sm text-gray-700 dark:text-gray-300">Track batches & expiry</label>
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
                {editItem && (
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
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alternate Units</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Rate is always per base unit ({currentBaseUnit || '—'}). Alternate units are for entry convenience.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => appendAu({ unit: '', conversion_factor: 1, is_default_purchase: false, is_default_sale: false })}
                disabled={altUnitOptions.length === 0}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Unit
              </Button>
            </div>

            {auFields.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                No alternate units. The base unit ({currentBaseUnit || '—'}) is always available.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                  <div className="col-span-3">Unit</div>
                  <div className="col-span-4">Conversion (1 unit = N base)</div>
                  <div className="col-span-2 text-center">Default Buy</div>
                  <div className="col-span-2 text-center">Default Sell</div>
                  <div className="col-span-1" />
                </div>
                {auFields.map((auField, auIndex) => {
                  const selectedAuUnit = watch(`alternate_units.${auIndex}.unit`);
                  return (
                    <div key={auField.id} className="grid grid-cols-12 items-center gap-2">
                      {/* Unit selector */}
                      <div className="col-span-3">
                        <SlideSelect
                          name={`alternate_units.${auIndex}.unit`}
                          placeholder="Select unit"
                          panelTitle="Select Unit"
                          options={altUnitOptions}
                          value={watch(`alternate_units.${auIndex}.unit`) ?? ''}
                          onChange={(val) => setValue(`alternate_units.${auIndex}.unit`, val, { shouldValidate: true })}
                          error={errors.alternate_units?.[auIndex]?.unit?.message}
                        />
                      </div>

                      {/* Conversion factor */}
                      <div className="col-span-4 flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 whitespace-nowrap">1 {selectedAuUnit || 'unit'} =</span>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1.5 text-sm"
                          {...register(`alternate_units.${auIndex}.conversion_factor`, { valueAsNumber: true })}
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">{currentBaseUnit || 'base'}</span>
                      </div>

                      {/* Default purchase */}
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="checkbox"
                          {...register(`alternate_units.${auIndex}.is_default_purchase`)}
                          className="h-4 w-4 rounded"
                        />
                      </div>

                      {/* Default sale */}
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="checkbox"
                          {...register(`alternate_units.${auIndex}.is_default_sale`)}
                          className="h-4 w-4 rounded"
                        />
                      </div>

                      {/* Remove */}
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
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={isUnitsLoading || formUnitOptions.length === 0}
            >
              {editItem ? 'Update' : 'Create'}
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
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* SKU Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by SKU
          </label>
          <input
            type="text"
            placeholder="Search by SKU..."
            value={skuFilter}
            onChange={(e) => { setSkuFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Group Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Group
          </label>
          <select
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Groups</option>
            {itemGroupsData?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Unit Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Unit
          </label>
          <select
            value={unitFilter}
            onChange={(e) => { setUnitFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Units</option>
            {unitOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={() => {
            setSearch('');
            setSkuFilter('');
            setGroupFilter('');
            setStatusFilter('');
            setUnitFilter('');
            setPage(1);
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear Filters
        </button>
      </FilterPanel>
    </div>
  );
}
