import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { reportsApi } from "@/api/accounting";
import type { BalanceSheetRow } from "@/types";
import { localDateToUtcRange } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileText,
  Filter,
  X,
  ArrowLeft,
  Scale,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "-";
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Math.abs(n));
  // Negative amounts shown in parentheses (accounting convention — e.g. ITC deducting from Duties & Taxes)
  return n < 0 ? `${formatted}` : formatted;
}

// ─── Tree & Aggregation ───────────────────────────────────────────────────────

interface Agg {
  opening_debit: number;
  opening_credit: number;
  txn_debit: number;
  txn_credit: number;
  closing_debit: number;
  closing_credit: number;
}

const ZERO: Agg = {
  opening_debit: 0,
  opening_credit: 0,
  txn_debit: 0,
  txn_credit: 0,
  closing_debit: 0,
  closing_credit: 0,
};

interface BsNode {
  row: BalanceSheetRow;
  children: BsNode[];
  agg: Agg;
}

function addAgg(a: Agg, b: Agg): Agg {
  return {
    opening_debit: a.opening_debit + b.opening_debit,
    opening_credit: a.opening_credit + b.opening_credit,
    txn_debit: a.txn_debit + b.txn_debit,
    txn_credit: a.txn_credit + b.txn_credit,
    closing_debit: a.closing_debit + b.closing_debit,
    closing_credit: a.closing_credit + b.closing_credit,
  };
}

function rowToAgg(row: BalanceSheetRow): Agg {
  return {
    opening_debit: row.opening_debit,
    opening_credit: row.opening_credit,
    txn_debit: row.txn_debit,
    txn_credit: row.txn_credit,
    closing_debit: row.closing_debit,
    closing_credit: row.closing_credit,
  };
}

function isNonZero(agg: Agg): boolean {
  return (
    agg.opening_debit !== 0 ||
    agg.opening_credit !== 0 ||
    agg.txn_debit !== 0 ||
    agg.txn_credit !== 0 ||
    agg.closing_debit !== 0 ||
    agg.closing_credit !== 0
  );
}

function sortRows(arr: BalanceSheetRow[]): BalanceSheetRow[] {
  return [...arr].sort((a, b) => {
    if (a.is_group !== b.is_group) return a.is_group ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Build a tree for one side of the balance sheet.
 * side='assets'      → rows where type === 'asset'
 * side='liabilities' → rows where type === 'liability' | 'equity'
 */
function buildBsTree(
  rows: BalanceSheetRow[],
  side: "assets" | "liabilities",
): BsNode[] {
  const filtered = rows.filter((r) =>
    side === "assets"
      ? r.type === "asset"
      : r.type === "liability" || r.type === "equity",
  );

  const childrenOf = new Map<string | null, BalanceSheetRow[]>();
  filtered.forEach((r) => {
    const k = r.parent_id ?? null;
    if (!childrenOf.has(k)) childrenOf.set(k, []);
    childrenOf.get(k)!.push(r);
  });

  function makeNode(row: BalanceSheetRow): BsNode {
    const kids = sortRows(childrenOf.get(row.account_id) ?? []).map(makeNode);
    const agg = row.is_group
      ? kids.reduce((acc, c) => addAgg(acc, c.agg), { ...ZERO })
      : rowToAgg(row);
    return { row, children: kids, agg };
  }

  return sortRows(childrenOf.get(null) ?? []).map(makeNode);
}

// ─── BsRow ────────────────────────────────────────────────────────────────────

interface BsRowProps {
  node: BsNode;
  depth: number;
  side: "assets" | "liabilities";
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZero: boolean;
  onLedgerClick: (id: string, name: string) => void;
}

function BsRow({
  node,
  depth,
  side,
  expandedSet,
  toggleExpand,
  hideZero,
  onLedgerClick,
}: BsRowProps) {
  const { row, children, agg } = node;
  const isGroup = row.is_group;
  const isExpanded = expandedSet.has(row.account_id);

  if (hideZero && !isNonZero(agg)) return null;

  // Net balance for the account's natural side:
  //   Assets      → debit-natural: closing_debit − closing_credit (positive = real asset)
  //   Liabilities → credit-natural: closing_credit − closing_debit
  //     Positive = liability/equity; Negative = ITC / contra entry (e.g. Input CGST under Duties & Taxes)
  //     Negative shown in parentheses as a deduction from the group total (Tally convention)
  const amount =
    side === "assets"
      ? agg.closing_debit - agg.closing_credit
      : agg.closing_credit - agg.closing_debit;
  const amountColor =
    side === "assets"
      ? "text-blue-700 dark:text-blue-300"
      : "text-purple-700 dark:text-purple-300";

  const pl = 12 + depth * 20;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/40 ${
          isGroup
            ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20"
            : "cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
        } ${depth === 0 && isGroup ? "bg-gray-50/50 dark:bg-gray-800/30" : ""}`}
        onClick={() =>
          isGroup
            ? toggleExpand(row.account_id)
            : onLedgerClick(row.account_id, row.name)
        }
      >
        {/* Name cell */}
        <td className="py-2 pr-4" style={{ paddingLeft: pl }}>
          <div className="flex items-center gap-1.5">
            {isGroup ? (
              <>
                <span className="text-gray-400 dark:text-gray-500">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              </>
            ) : (
              <>
                <span className="w-3.5 flex-shrink-0" />
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              </>
            )}
            <span
              className={`text-sm ${
                isGroup
                  ? "font-semibold text-gray-900 dark:text-gray-100"
                  : "text-gray-700 hover:text-blue-600 hover:underline underline-offset-2 dark:text-gray-300 dark:hover:text-blue-400"
              }`}
            >
              {row.name}
            </span>
          </div>
        </td>

        {/* Amount cell */}
        <td
          className={`py-2 pl-3 pr-4 text-right font-mono text-sm ${
            isGroup ? `font-bold ${amountColor}` : `font-medium ${amountColor}`
          }`}
        >
          {fmt(amount)}
        </td>
      </tr>

      {isExpanded &&
        children.map((child) => (
          <BsRow
            key={child.row.account_id}
            node={child}
            depth={depth + 1}
            side={side}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            hideZero={hideZero}
            onLedgerClick={onLedgerClick}
          />
        ))}
    </>
  );
}

// ─── BsSection ────────────────────────────────────────────────────────────────

interface BsSectionProps {
  side: "assets" | "liabilities";
  nodes: BsNode[];
  ledgerTotal: number;
  /** Liabilities side: net profit from P&L added at bottom */
  netProfit?: number;
  isProfit?: boolean;
  /** Assets side: closing stock from stock_ledger added at bottom */
  closingStock?: number;
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZero: boolean;
  onLedgerClick: (id: string, name: string) => void;
}

function BsSection({
  side,
  nodes,
  ledgerTotal,
  netProfit,
  isProfit,
  closingStock,
  expandedSet,
  toggleExpand,
  hideZero,
  onLedgerClick,
}: BsSectionProps) {
  const isAssets = side === "assets";

  // Grand total includes closing stock (assets) or net profit (liabilities)
  const extraAmount = isAssets
    ? (closingStock ?? 0)
    : isProfit
      ? (netProfit ?? 0)
      : 0;
  // Net loss reduces equity — shown on liabilities side as negative (reduces total)
  const netLossDeduction = !isAssets && !isProfit ? (netProfit ?? 0) : 0;
  const grandTotal = ledgerTotal + extraAmount - netLossDeduction;

  const headerBg = isAssets
    ? "bg-blue-600 dark:bg-blue-700"
    : "bg-purple-700 dark:bg-purple-800";
  const borderColor = isAssets
    ? "border-blue-200 dark:border-blue-800/50"
    : "border-purple-200 dark:border-purple-800/50";
  const totalBg = isAssets
    ? "bg-blue-50 dark:bg-blue-950/30"
    : "bg-purple-50 dark:bg-purple-950/30";
  const totalText = isAssets
    ? "text-blue-800 dark:text-blue-200"
    : "text-purple-800 dark:text-purple-200";

  return (
    <div
      className={`overflow-hidden rounded-lg border shadow-sm ${borderColor} bg-white dark:bg-gray-800`}
    >
      {/* Section header */}
      <div className={`px-4 py-3 ${headerBg}`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {isAssets ? "Assets" : "Liabilities & Equity"}
        </h2>
        <p className="mt-0.5 text-xs text-white/70">
          {isAssets
            ? "Fixed Assets · Current Assets · Investments"
            : "Capital · Loans · Creditors · Duties & Taxes"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                Particulars
              </th>
              <th className="w-36 px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500"
                >
                  No accounts found
                </td>
              </tr>
            ) : (
              nodes.map((node) => (
                <BsRow
                  key={node.row.account_id}
                  node={node}
                  depth={0}
                  side={side}
                  expandedSet={expandedSet}
                  toggleExpand={toggleExpand}
                  hideZero={hideZero}
                  onLedgerClick={onLedgerClick}
                />
              ))
            )}

            {/* Closing Stock row — Assets side only */}
            {isAssets && (closingStock ?? 0) > 0 && (
              <tr className="border-b border-amber-100 bg-amber-50/60 dark:border-amber-800/30 dark:bg-amber-900/10">
                <td className="py-2 pl-4 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-800/50 dark:text-amber-300">
                      Stock
                    </span>
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Closing Stock
                    </span>
                  </div>
                </td>
                <td className="py-2 pl-3 pr-4 text-right font-mono text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {fmt(closingStock ?? 0)}
                </td>
              </tr>
            )}

            {/* Net Profit / Net Loss row — Liabilities side only */}
            {!isAssets && (netProfit ?? 0) > 0 && (
              <tr
                className={`border-b ${
                  isProfit
                    ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-800/30 dark:bg-emerald-900/10"
                    : "border-red-100 bg-red-50/60 dark:border-red-800/30 dark:bg-red-900/10"
                }`}
              >
                <td className="py-2 pl-4 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        isProfit
                          ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-300"
                          : "bg-red-200 text-red-800 dark:bg-red-800/50 dark:text-red-300"
                      }`}
                    >
                      P&amp;L
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isProfit
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-red-900 dark:text-red-200"
                      }`}
                    >
                      {isProfit ? "Net Profit b/f" : "Net Loss b/f"}
                    </span>
                    {isProfit ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                </td>
                <td
                  className={`py-2 pl-3 pr-4 text-right font-mono text-sm font-semibold ${
                    isProfit
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {isProfit ? fmt(netProfit ?? 0) : `(${fmt(netProfit ?? 0)})`}
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand Total */}
          <tfoot>
            <tr className={`border-t-2 ${borderColor} ${totalBg}`}>
              <td className={`px-4 py-3 text-sm font-bold ${totalText}`}>
                Total {isAssets ? "Assets" : "Liabilities & Equity"}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono text-sm font-bold ${totalText}`}
              >
                {fmt(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Ledger Drill-down Panel ──────────────────────────────────────────────────

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  sales:
    "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
  purchase: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
  payment: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
  receipt:
    "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30",
  journal: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50",
  contra:
    "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30",
};

interface DrillDownProps {
  ledgerId: string;
  ledgerName: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}

function LedgerDrillDownPanel({
  ledgerId,
  ledgerName,
  dateFrom,
  dateTo,
  onClose,
}: DrillDownProps) {
  const params: Record<string, string> = { ledger_id: ledgerId };
  if (dateFrom && dateTo) {
    const { date_from, date_to } = localDateToUtcRange(dateFrom, dateTo);
    params.date_from = date_from;
    params.date_to = date_to;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["ledger-transactions", ledgerId, dateFrom, dateTo],
    queryFn: () => reportsApi.ledgerTransactions(params),
    select: (res) => res.data,
  });

  const ledger = data?.ledger;
  const transactions = data?.data ?? [];
  const closingBalance = data?.closing_balance ?? 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {ledgerName}
            </h3>
            {ledger?.group_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Under: {ledger.group_name}
              </p>
            )}
          </div>
        </div>

        {/* Opening balance bar */}
        {ledger && (
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-2.5 dark:border-gray-700/50 dark:bg-gray-800/60">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Opening Balance
            </span>
            <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
              {ledger.opening_debit > 0
                ? `${fmt(ledger.opening_debit)} Dr`
                : ledger.opening_credit > 0
                  ? `${fmt(ledger.opening_credit)} Cr`
                  : "-"}
            </span>
          </div>
        )}

        {/* Transactions */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
              No transactions found for this ledger
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">
                    Voucher #
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">
                    Narration
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                    Debit
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                    Credit
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-400">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600 dark:text-gray-400">
                      {new Date(txn.voucher_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {txn.voucher_number}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          VOUCHER_TYPE_COLORS[txn.voucher_type] ??
                          VOUCHER_TYPE_COLORS.journal
                        }`}
                      >
                        {txn.voucher_type}
                      </span>
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-2 text-gray-500 dark:text-gray-400">
                      {txn.narration ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700 dark:text-blue-400">
                      {txn.debit !== 0 ? fmt(txn.debit) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 dark:text-red-400">
                      {txn.credit !== 0 ? fmt(txn.credit) : "-"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right font-mono font-medium ${
                        txn.balance >= 0
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {txn.balance !== 0
                        ? `${fmt(Math.abs(txn.balance))} ${txn.balance >= 0 ? "Dr" : "Cr"}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Closing balance bar */}
        <div className="flex items-center justify-between border-t-2 border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/60">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Closing Balance
          </span>
          <span
            className={`font-mono text-sm font-bold ${
              closingBalance >= 0
                ? "text-blue-700 dark:text-blue-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {closingBalance !== 0
              ? `${fmt(Math.abs(closingBalance))} ${closingBalance >= 0 ? "Dr" : "Cr"}`
              : "Nil"}
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  hideZero: boolean;
  setHideZero: (v: boolean) => void;
  onApply: () => void;
  onReset: () => void;
}

function FilterPanel({
  open,
  onClose,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  hideZero,
  setHideZero,
  onApply,
  onReset,
}: FilterPanelProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Leave empty to use the selected Financial Year.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visibility
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Hide zero-balance accounts
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Hide groups and ledgers with no activity
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <button
              onClick={onReset}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Reset
            </button>
            <button
              onClick={onApply}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BalanceSheet() {
  usePageTitle("Balance Sheet");

  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (appliedDateFrom && appliedDateTo) {
      const { date_from, date_to } = localDateToUtcRange(appliedDateFrom, appliedDateTo);
      p.date_from = date_from;
      p.date_to = date_to;
    }
    return p;
  }, [appliedDateFrom, appliedDateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-balance-sheet", appliedDateFrom, appliedDateTo],
    queryFn: () => reportsApi.balanceSheet(queryParams),
    select: (res) => res.data,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  const assetNodes = useMemo(() => buildBsTree(rows, "assets"), [rows]);
  const liabilityNodes = useMemo(
    () => buildBsTree(rows, "liabilities"),
    [rows],
  );

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    function collect(nodes: BsNode[]) {
      for (const n of nodes) {
        if (n.row.is_group) {
          ids.add(n.row.account_id);
          collect(n.children);
        }
      }
    }
    collect(assetNodes);
    collect(liabilityNodes);
    setExpandedSet(ids);
  }, [assetNodes, liabilityNodes]);

  const collapseAll = useCallback(() => setExpandedSet(new Set()), []);

  const handleApply = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setFilterOpen(false);
  };

  const handleReset = () => {
    setDateFrom("");
    setDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setFilterOpen(false);
  };

  const hasFilter = !!(appliedDateFrom || appliedDateTo);
  const isOutOfBalance = summary && Math.abs(summary.difference) > 1;

  // Grand totals for the summary card
  const totalAssetsGrand =
    (summary?.total_assets ?? 0) + (summary?.closing_stock ?? 0);
  const totalLiabGrand =
    (summary?.total_liabilities_equity ?? 0) +
    (summary?.is_profit
      ? (summary?.net_profit ?? 0)
      : -(summary?.net_profit ?? 0));

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Balance Sheet
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {appliedDateFrom && appliedDateTo
              ? `As at ${appliedDateTo}`
              : "As at end of selected Financial Year · Click groups to expand · Click ledgers to drill down"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Collapse All
          </button>
          <button
            onClick={() => setFilterOpen(true)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              hasFilter
                ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilter && (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active date badge */}
      {(appliedDateFrom || appliedDateTo) && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className="font-medium text-indigo-700 dark:text-indigo-300">
            Custom range:
          </span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {appliedDateFrom || "..."} → {appliedDateTo || "..."}
          </span>
          <button
            onClick={handleReset}
            className="ml-auto text-indigo-400 hover:text-indigo-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Scale className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            No accounts found. Set up your chart of accounts and post some
            transactions.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          {summary && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Scale className="h-8 w-8 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                <div className="flex flex-1 flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Total Assets
                    </p>
                    <p className="font-mono text-lg font-bold text-blue-700 dark:text-blue-300">
                      {fmt(totalAssetsGrand)}
                    </p>
                  </div>
                  <div className="text-gray-300 dark:text-gray-600">=</div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Liabilities + Equity
                    </p>
                    <p className="font-mono text-lg font-bold text-purple-700 dark:text-purple-300">
                      {fmt(totalLiabGrand)}
                    </p>
                  </div>
                  <div className="text-gray-300 dark:text-gray-600">+</div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {summary.is_profit ? "Net Profit" : "Net Loss"}
                    </p>
                    <p
                      className={`font-mono text-lg font-bold ${
                        summary.is_profit
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {summary.is_profit ? "" : "("}
                      {fmt(summary.net_profit)}
                      {summary.is_profit ? "" : ")"}
                    </p>
                  </div>

                  {summary.closing_stock > 0 && (
                    <>
                      <div className="text-gray-300 dark:text-gray-600">·</div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Closing Stock
                        </p>
                        <p className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
                          {fmt(summary.closing_stock)}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Balance check badge */}
                {isOutOfBalance ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 dark:bg-amber-900/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Out of balance: {fmt(Math.abs(summary.difference))}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      ✓ Balanced
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Two-column layout: Liabilities (left, Tally convention) | Assets (right) */}
          <div className="grid gap-5 xl:grid-cols-2">
            <BsSection
              side="liabilities"
              nodes={liabilityNodes}
              ledgerTotal={summary?.total_liabilities_equity ?? 0}
              netProfit={summary?.net_profit}
              isProfit={summary?.is_profit}
              expandedSet={expandedSet}
              toggleExpand={toggleExpand}
              hideZero={hideZero}
              onLedgerClick={(id, name) => setDrillDown({ id, name })}
            />
            <BsSection
              side="assets"
              nodes={assetNodes}
              ledgerTotal={summary?.total_assets ?? 0}
              closingStock={summary?.closing_stock}
              expandedSet={expandedSet}
              toggleExpand={toggleExpand}
              hideZero={hideZero}
              onLedgerClick={(id, name) => setDrillDown({ id, name })}
            />
          </div>
        </>
      )}

      {/* Drill-down panel */}
      {drillDown && (
        <LedgerDrillDownPanel
          ledgerId={drillDown.id}
          ledgerName={drillDown.name}
          dateFrom={appliedDateFrom}
          dateTo={appliedDateTo}
          onClose={() => setDrillDown(null)}
        />
      )}

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        hideZero={hideZero}
        setHideZero={setHideZero}
        onApply={handleApply}
        onReset={handleReset}
      />
    </div>
  );
}
