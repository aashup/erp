import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { itemsApi, itemGroupsApi, unitsApi } from "@/api/inventory";
import type { Item, ItemGroup, Unit } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import {
  Plus,
  Filter,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  PackageOpen,
} from "lucide-react";
import { FilterPanel } from "@/components/ui/FilterPanel";

export default function Items() {
  usePageTitle("Items");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.edit");
  const canDelete = hasPermission("inventory.delete");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = useQuery({
    queryKey: [
      "items",
      page,
      search,
      skuFilter,
      groupFilter,
      statusFilter,
      unitFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      itemsApi.list({
        page: String(page),
        search,
        per_page: "25",
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(skuFilter ? { sku: skuFilter } : {}),
        ...(groupFilter ? { item_group_id: groupFilter } : {}),
        ...(statusFilter
          ? { is_active: statusFilter === "active" ? "1" : "0" }
          : {}),
        ...(unitFilter ? { unit: unitFilter } : {}),
      }),
    select: (res) => res.data,
  });

  const { data: unitsData } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
    },
  });

  const unitOptions = (unitsData?.data ?? []).map((unit: Unit) => ({
    value: unit.value,
    label: unit.label,
  }));

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const columns: ColumnDef<Item, unknown>[] = [
    {
      id: "name",
      header: () => (
        <button
          onClick={() => handleSort("name")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by name"
        >
          Name
          {renderSortIcon("name")}
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.name}</span>
          {row.original.is_batch_tracked && <Badge variant="info">Batch</Badge>}
        </div>
      ),
    },
    {
      id: "sku",
      header: () => (
        <button
          onClick={() => handleSort("sku")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by SKU"
        >
          SKU
          {renderSortIcon("sku")}
        </button>
      ),
      accessorKey: "sku",
    },
    {
      id: "hsn_code",
      header: () => (
        <button
          onClick={() => handleSort("hsn_code")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by HSN"
        >
          HSN
          {renderSortIcon("hsn_code")}
        </button>
      ),
      accessorKey: "hsn_code",
    },
    {
      id: "unit",
      header: () => (
        <button
          onClick={() => handleSort("unit")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by unit"
        >
          Unit
          {renderSortIcon("unit")}
        </button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{item.unit}</span>
            {/* {(item.alternate_units ?? []).length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +
                {altUnits
                  .map((au) => `${au.unit}(×${au.conversion_factor})`)
                  .join(", ")}
              </span>
            )} */}
          </div>
        );
      },
    },
    {
      id: "group_name",
      header: () => (
        <button
          onClick={() => handleSort("group_name")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by group"
        >
          Group
          {renderSortIcon("group_name")}
        </button>
      ),
      cell: ({ row }) => row.original.item_group?.name ?? "—",
    },
    {
      id: "igst",
      header: () => (
        <button
          onClick={() => handleSort("igst")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by IGST"
        >
          IGST %{renderSortIcon("igst")}
        </button>
      ),
      cell: ({ row }) => `${row.original.igst}%`,
    },
    {
      id: "sgst",
      header: () => (
        <button
          onClick={() => handleSort("sgst")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by SGST"
        >
          SGST %{renderSortIcon("sgst")}
        </button>
      ),
      cell: ({ row }) => `${row.original.sgst}%`,
    },
    {
      id: "cgst",
      header: () => (
        <button
          onClick={() => handleSort("cgst")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by CGST"
        >
          CGST %{renderSortIcon("cgst")}
        </button>
      ),
      cell: ({ row }) => `${row.original.cgst}%`,
    },
    {
      id: "selling_price",
      header: () => (
        <button
          onClick={() => handleSort("selling_price")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by price"
        >
          Price
          {renderSortIcon("selling_price")}
        </button>
      ),
      cell: ({ row }) => {
        const v = row.original.selling_price;
        return v ? formatCurrency(v) : "—";
      },
    },
    {
      id: "is_active",
      header: () => (
        <button
          onClick={() => handleSort("is_active")}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
          title="Click to sort by status"
        >
          Status
          {renderSortIcon("is_active")}
        </button>
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "success" : "danger"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: Item } }) => (
        <div className="flex items-center gap-1">
          {row.original.is_batch_tracked && (
            <button
              onClick={() =>
                navigate(`/inventory/items/${row.original.id}/batches`)
              }
              className="rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              title="Manage Batches"
            >
              <PackageOpen className="h-4 w-4 text-blue-500" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => navigate(`/inventory/items/${row.original.id}/edit`)}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm("Delete this item?"))
                  deleteMutation.mutate(row.original.id);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Items
        </h1>
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
              <Button onClick={() => navigate("/inventory/items/new")}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
        />
        {data && (
          <Pagination
            currentPage={data.current_page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>

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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setSkuFilter(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Groups</option>
            {itemGroupsData?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All Units</option>
            {unitOptions.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={() => {
            setSearch("");
            setSkuFilter("");
            setGroupFilter("");
            setStatusFilter("");
            setUnitFilter("");
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
