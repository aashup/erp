import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { usePageTitle } from "@/hooks/usePageTitle";
import { vouchersApi, paymentReceiptsApi } from "@/api/accounting";
import type { Voucher, PaymentReceipt } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { PaymentVoucherDetailModal } from "@/components/accounting/PaymentVoucherDetailModal";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  BookOpen,
  ShoppingCart,
  Receipt,
  Filter,
} from "lucide-react";
import { FilterPanel } from "@/components/ui/FilterPanel";

type VoucherTab =
  | "contra"
  | "payment"
  | "receipt"
  | "journal"
  | "sales"
  | "purchase";

const TYPE_CONFIG: Record<
  VoucherTab,
  {
    label: string;
    shortcut: string;
    icon: typeof ArrowLeftRight;
    color: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  contra: {
    label: "Contra",
    shortcut: "F4",
    icon: ArrowLeftRight,
    color: "text-purple-700 dark:text-purple-300",
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  payment: {
    label: "Payment",
    shortcut: "F5",
    icon: CreditCard,
    color: "text-red-700 dark:text-red-300",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-600 dark:text-red-400",
  },
  receipt: {
    label: "Receipt",
    shortcut: "F6",
    icon: HandCoins,
    color: "text-green-700 dark:text-green-300",
    iconBg: "bg-green-100 dark:bg-green-900/40",
    iconColor: "text-green-600 dark:text-green-400",
  },
  journal: {
    label: "Journal",
    shortcut: "F7",
    icon: BookOpen,
    color: "text-blue-700 dark:text-blue-300",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  sales: {
    label: "Sales",
    shortcut: "F8",
    icon: Receipt,
    color: "text-emerald-700 dark:text-emerald-300",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  purchase: {
    label: "Purchase",
    shortcut: "F9",
    icon: ShoppingCart,
    color: "text-orange-700 dark:text-orange-300",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
};

const PAYMENT_TYPES = new Set<VoucherTab>(["payment", "receipt"]);

export default function VoucherTypeList() {
  const { type } = useParams<{ type: VoucherTab }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const voucherType = (type ?? "journal") as VoucherTab;
  const config = TYPE_CONFIG[voucherType] ?? TYPE_CONFIG.journal;
  const isPaymentType = PAYMENT_TYPES.has(voucherType);

  usePageTitle(`${config.label} Vouchers`);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showDetail, setShowDetail] = useState<Voucher | null>(null);
  const [showPaymentDetail, setShowPaymentDetail] = useState<PaymentReceipt | null>(null);

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [appliedDateFrom, setAppliedDateFrom] = useState(monthStart);
  const [appliedDateTo, setAppliedDateTo] = useState(monthEnd);

  const hasFilter = appliedDateFrom !== monthStart || appliedDateTo !== monthEnd;

  // ─── Journal/Contra/Sales/Purchase list ──────────────────────────────────

  const { data: journalData, isLoading: journalLoading } = useQuery({
    queryKey: ["vouchers", voucherType, page, search, appliedDateFrom, appliedDateTo],
    queryFn: () =>
      vouchersApi.list({
        page: String(page),
        search,
        voucher_type: voucherType,
        date_from: appliedDateFrom,
        date_to: appliedDateTo,
      }),
    select: (res) => res.data,
    enabled: !isPaymentType,
  });

  // ─── Payment/Receipt list ─────────────────────────────────────────────────

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ["payment-receipts", voucherType, page, search, appliedDateFrom, appliedDateTo],
    queryFn: () =>
      paymentReceiptsApi.list({
        page: String(page),
        search,
        type: voucherType,
        date_from: appliedDateFrom,
        date_to: appliedDateTo,
      }),
    select: (res) => res.data,
    enabled: isPaymentType,
  });

  const paymentDeleteMutation = useMutation({
    mutationFn: (id: string) => paymentReceiptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-receipts"] });
      toast.success("Record deleted");
    },
  });

  // ─── Columns ─────────────────────────────────────────────────────────────

  const journalColumns: ColumnDef<Voucher, unknown>[] = [
    { accessorKey: "voucher_number", header: "Voucher #" },
    {
      accessorKey: "voucher_date",
      header: "Date",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      accessorKey: "narration",
      header: "Narration",
      cell: ({ getValue }) => (
        <span className="truncate max-w-[200px] block">
          {(getValue() as string) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "is_posted",
      header: "Status",
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? "success" : "warning"}>
          {getValue() ? "Posted" : "Draft"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setShowDetail(row.original)}
          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      ),
    },
  ];

  const paymentColumns: ColumnDef<PaymentReceipt, unknown>[] = [
    { accessorKey: "receipt_number", header: "Number" },
    { header: "Party", cell: ({ row }) => row.original.party?.name ?? "—" },
    {
      accessorKey: "receipt_date",
      header: "Date",
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      accessorKey: "payment_mode",
      header: "Mode",
      cell: ({ getValue }) => (
        <Badge>{(getValue() as string).toUpperCase()}</Badge>
      ),
    },
    {
      accessorKey: "reference_number",
      header: "Reference",
      cell: ({ getValue }) => (getValue() as string) ?? "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPaymentDetail(row.original)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="View journal entry"
          >
            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() =>
              navigate(`/accounting/vouchers/${voucherType}/new`, {
                state: { edit: row.original },
              })
            }
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this record?"))
                paymentDeleteMutation.mutate(row.original.id);
            }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/accounting/vouchers")}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}
          >
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${config.color}`}>
              {config.label} Vouchers
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shortcut:{" "}
              <kbd className="px-1 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 rounded">
                {config.shortcut}
              </kbd>
              {" · "}
              {formatDate(appliedDateFrom)} → {formatDate(appliedDateTo)}
            </p>
          </div>
        </div>
      </div>

      {/* List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder={`Search ${config.label.toLowerCase()} vouchers...`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterPanel(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters{hasFilter ? " (1)" : ""}
              </button>
              <Button
                onClick={() =>
                  navigate(`/accounting/vouchers/${voucherType}/new`)
                }
              >
                <Plus className="mr-2 h-4 w-4" /> New {config.label}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isPaymentType ? (
          <>
            <DataTable
              columns={paymentColumns}
              data={paymentData?.data ?? []}
              loading={paymentLoading}
            />
            {paymentData && (
              <Pagination
                currentPage={paymentData.current_page}
                lastPage={paymentData.last_page}
                total={paymentData.total}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <>
            <DataTable
              columns={journalColumns}
              data={journalData?.data ?? []}
              loading={journalLoading}
            />
            {journalData && (
              <Pagination
                currentPage={journalData.current_page}
                lastPage={journalData.last_page}
                total={journalData.total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {/* Payment/Receipt Detail Modal */}
      <PaymentVoucherDetailModal
        record={showPaymentDetail}
        onClose={() => setShowPaymentDetail(null)}
      />

      {/* Date Range Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setDateFrom(monthStart);
              setDateTo(monthEnd);
              setAppliedDateFrom(monthStart);
              setAppliedDateTo(monthEnd);
              setShowFilterPanel(false);
            }}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Reset
          </button>
          <button
            onClick={() => {
              setAppliedDateFrom(dateFrom);
              setAppliedDateTo(dateTo);
              setPage(1);
              setShowFilterPanel(false);
            }}
            className="flex-1 rounded-lg bg-primary-600 text-white px-3 py-2 text-sm hover:bg-primary-700"
          >
            Apply
          </button>
        </div>
      </FilterPanel>

      {/* Journal Detail Modal */}
      <Modal
        open={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={`Voucher: ${showDetail?.voucher_number ?? ""}`}
        size="lg"
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Date: </span>
                <span className="font-medium">
                  {formatDate(showDetail.voucher_date)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Type: </span>
                <Badge>{showDetail.voucher_type}</Badge>
              </div>
              <div>
                <span className="text-gray-500">Status: </span>
                <Badge variant={showDetail.is_posted ? "success" : "warning"}>
                  {showDetail.is_posted ? "Posted" : "Draft"}
                </Badge>
              </div>
              {showDetail.narration && (
                <div className="col-span-2">
                  <span className="text-gray-500">Narration: </span>
                  <span>{showDetail.narration}</span>
                </div>
              )}
            </div>
            {showDetail.lines && showDetail.lines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2">Ledger</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {showDetail.lines.map((line) => (
                    <tr key={line.id} className="border-b dark:border-gray-700">
                      <td className="py-2">
                        {line.ledger?.name ?? line.ledger_id}
                      </td>
                      <td className="py-2 text-right">
                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">
                      {formatCurrency(
                        showDetail.lines.reduce((s, l) => s + +l.debit || 0, 0),
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(
                        showDetail.lines.reduce(
                          (s, l) => s + +l.credit || 0,
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
