import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi } from '@/api/accounting';
import type { PnlRow } from '@/types';
import {
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  FolderOpen,
  FileText,
  Filter,
  X,
  ArrowLeft,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

interface PnlNode {
  row: PnlRow;
  children: PnlNode[];
  aggAmount: number; // aggregated from all descendant ledgers
}

function sortRows(arr: PnlRow[]): PnlRow[] {
  return [...arr].sort((a, b) => {
    if (a.is_group !== b.is_group) return a.is_group ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function buildPnlTree(rows: PnlRow[], type: 'income' | 'expense'): PnlNode[] {
  const typeRows = rows.filter((r) => r.type === type);

  const childrenOf = new Map<string | null, PnlRow[]>();
  typeRows.forEach((r) => {
    const k = r.parent_id ?? null;
    if (!childrenOf.has(k)) childrenOf.set(k, []);
    childrenOf.get(k)!.push(r);
  });

  function makeNode(row: PnlRow): PnlNode {
    const kids = sortRows(childrenOf.get(row.account_id) ?? []).map(makeNode);
    const aggAmount = row.is_group
      ? kids.reduce((sum, c) => sum + c.aggAmount, 0)
      : row.amount;
    return { row, children: kids, aggAmount };
  }

  return sortRows(childrenOf.get(null) ?? []).map(makeNode);
}

// ─── P&L Row ─────────────────────────────────────────────────────────────────

interface PnlRowProps {
  node: PnlNode;
  depth: number;
  type: 'income' | 'expense';
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZero: boolean;
  onLedgerClick: (id: string, name: string) => void;
}

function PnlRowItem({
  node,
  depth,
  type,
  expandedSet,
  toggleExpand,
  hideZero,
  onLedgerClick,
}: PnlRowProps) {
  const { row, children, aggAmount } = node;
  const isGroup = row.is_group;
  const isExpanded = expandedSet.has(row.account_id);

  if (hideZero && aggAmount === 0) return null;

  const amountColor =
    type === 'income'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-700 dark:text-red-400';

  const pl = 12 + depth * 20;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/40 ${
          isGroup
            ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20'
            : 'cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
        } ${depth === 0 && isGroup ? 'bg-gray-50/60 dark:bg-gray-800/40' : ''}`}
        onClick={() =>
          isGroup ? toggleExpand(row.account_id) : onLedgerClick(row.account_id, row.name)
        }
      >
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
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300 hover:underline underline-offset-2'
              }`}
            >
              {row.name}
            </span>
          </div>
        </td>
        <td className={`px-4 py-2 text-right font-mono text-sm ${isGroup ? `font-bold ${amountColor}` : amountColor}`}>
          {aggAmount !== 0 ? fmt(Math.abs(aggAmount)) : '-'}
        </td>
      </tr>

      {isExpanded &&
        children.map((child) => (
          <PnlRowItem
            key={child.row.account_id}
            node={child}
            depth={depth + 1}
            type={type}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            hideZero={hideZero}
            onLedgerClick={onLedgerClick}
          />
        ))}
    </>
  );
}

// ─── Ledger Drill-down Panel ──────────────────────────────────────────────────

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  sales: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  purchase: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  payment: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
  receipt: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
  journal: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50',
  contra: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
};

interface DrillDownProps {
  ledgerId: string;
  ledgerName: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}

function LedgerDrillDownPanel({ ledgerId, ledgerName, dateFrom, dateTo, onClose }: DrillDownProps) {
  const params: Record<string, string> = { ledger_id: ledgerId };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ['ledger-transactions', ledgerId, dateFrom, dateTo],
    queryFn: () => reportsApi.ledgerTransactions(params),
    select: (res) => res.data,
  });

  const ledger = data?.ledger;
  const transactions = data?.data ?? [];
  const closingBalance = data?.closing_balance ?? 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
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
            <h3 className="font-semibold text-gray-900 dark:text-white">{ledgerName}</h3>
            {ledger?.group_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Under: {ledger.group_name}</p>
            )}
          </div>
        </div>

        {/* Opening balance */}
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
                  : '-'}
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
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">Voucher #</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">Type</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">Narration</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">Dr</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">Cr</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-400">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600 dark:text-gray-400">
                      {new Date(txn.voucher_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {txn.voucher_number}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          VOUCHER_TYPE_COLORS[txn.voucher_type] ?? VOUCHER_TYPE_COLORS.journal
                        }`}
                      >
                        {txn.voucher_type}
                      </span>
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-2 text-gray-500 dark:text-gray-400">
                      {txn.narration ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700 dark:text-blue-400">
                      {txn.debit !== 0 ? fmt(txn.debit) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 dark:text-red-400">
                      {txn.credit !== 0 ? fmt(txn.credit) : '-'}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right font-mono font-medium ${
                        txn.balance >= 0
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {txn.balance !== 0
                        ? `${fmt(Math.abs(txn.balance))} ${txn.balance >= 0 ? 'Dr' : 'Cr'}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Closing balance */}
        <div className="flex items-center justify-between border-t-2 border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/60">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Closing Balance
          </span>
          <span
            className={`font-mono text-sm font-bold ${
              closingBalance >= 0
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {closingBalance !== 0
              ? `${fmt(Math.abs(closingBalance))} ${closingBalance >= 0 ? 'Dr' : 'Cr'}`
              : 'Nil'}
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Stock Row (special non-ledger item) ─────────────────────────────────────

interface StockRowProps {
  label: string;
  value: number;
  type: 'income' | 'expense';
}

function StockRow({ label, value, type }: StockRowProps) {
  if (value === 0) return null;
  const color =
    type === 'income'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-amber-700 dark:text-amber-400';
  return (
    <tr className="border-b border-amber-100 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-900/10">
      <td className="py-2 pr-4" style={{ paddingLeft: 12 }}>
        <div className="flex items-center gap-2">
          <span className="w-3.5 flex-shrink-0" />
          {/* box icon for stock */}
          <svg className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
          <span className={`text-sm font-semibold italic ${color}`}>{label}</span>
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            Stock
          </span>
        </div>
      </td>
      <td className={`px-4 py-2 text-right font-mono text-sm font-bold ${color}`}>
        {fmt(value)}
      </td>
    </tr>
  );
}

// ─── Section Table ─────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  type: 'income' | 'expense';
  nodes: PnlNode[];
  ledgerTotal: number;    // sum from accounting ledgers only
  stockValue: number;     // opening or closing stock from stock_ledger
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZero: boolean;
  onLedgerClick: (id: string, name: string) => void;
}

function PnlSection({
  title,
  type,
  nodes,
  ledgerTotal,
  stockValue,
  expandedSet,
  toggleExpand,
  hideZero,
  onLedgerClick,
}: SectionProps) {
  const headerBg =
    type === 'income'
      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  const headerText =
    type === 'income'
      ? 'text-emerald-800 dark:text-emerald-300'
      : 'text-red-800 dark:text-red-300';
  const totalBg =
    type === 'income'
      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-300 dark:border-emerald-700'
      : 'bg-red-50 dark:bg-red-900/20 border-t-2 border-red-300 dark:border-red-700';
  const totalText =
    type === 'income'
      ? 'text-emerald-800 dark:text-emerald-300'
      : 'text-red-800 dark:text-red-300';

  // Grand total for this section = ledgers + stock line
  const grandTotal = Math.abs(ledgerTotal) + stockValue;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Section header */}
      <div className={`border-b px-4 py-3 ${headerBg}`}>
        <h2 className={`text-base font-bold ${headerText}`}>{title}</h2>
      </div>

      {/* Rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                Particulars
              </th>
              <th className="w-44 px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Opening stock at top of Expense side */}
            {type === 'expense' && (
              <StockRow label="Opening Stock" value={stockValue} type={type} />
            )}

            {nodes.length === 0 && stockValue === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No {title.toLowerCase()} entries
                </td>
              </tr>
            ) : (
              nodes.map((node) => (
                <PnlRowItem
                  key={node.row.account_id}
                  node={node}
                  depth={0}
                  type={type}
                  expandedSet={expandedSet}
                  toggleExpand={toggleExpand}
                  hideZero={hideZero}
                  onLedgerClick={onLedgerClick}
                />
              ))
            )}

            {/* Closing stock at bottom of Income side */}
            {type === 'income' && (
              <StockRow label="Closing Stock" value={stockValue} type={type} />
            )}
          </tbody>
          <tfoot>
            <tr className={totalBg}>
              <td className={`px-3 py-3 text-sm font-bold ${totalText}`}>Total {title}</td>
              <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${totalText}`}>
                {fmt(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ProfitAndLoss() {
  usePageTitle('Profit & Loss');

  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<{ id: string; name: string } | null>(null);

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
    if (appliedDateFrom) p.date_from = appliedDateFrom;
    if (appliedDateTo) p.date_to = appliedDateTo;
    return p;
  }, [appliedDateFrom, appliedDateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-profit-and-loss', appliedDateFrom, appliedDateTo],
    queryFn: () => reportsApi.profitAndLoss(queryParams),
    select: (res) => res.data,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  const incomeNodes = useMemo(() => buildPnlTree(rows, 'income'), [rows]);
  const expenseNodes = useMemo(() => buildPnlTree(rows, 'expense'), [rows]);

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    function collect(nodes: PnlNode[]) {
      for (const n of nodes) {
        if (n.row.is_group) {
          ids.add(n.row.account_id);
          collect(n.children);
        }
      }
    }
    collect(incomeNodes);
    collect(expenseNodes);
    setExpandedSet(ids);
  }, [incomeNodes, expenseNodes]);

  const collapseAll = useCallback(() => setExpandedSet(new Set()), []);

  const handleApply = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setFilterOpen(false);
  };
  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setFilterOpen(false);
  };

  const hasFilter = !!(appliedDateFrom || appliedDateTo);
  const hasData = rows.length > 0;

  const netPnl = summary?.net_profit_loss ?? 0;
  const isProfit = summary?.is_profit ?? true;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profit &amp; Loss Statement
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Click groups to expand · Click ledgers to view transactions
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
                ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
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
          <span className="font-medium text-indigo-700 dark:text-indigo-300">Custom range:</span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {appliedDateFrom || '...'} → {appliedDateTo || '...'}
          </span>
          <button onClick={handleReset} className="ml-auto text-indigo-400 hover:text-indigo-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : !hasData ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No income or expense entries found. Create some transactions to see the P&amp;L
            statement.
          </p>
        </div>
      ) : (
        <>
          {/* Net P&L Summary Card */}
          <div
            className={`flex items-center justify-between rounded-xl border-2 px-6 py-4 ${
              isProfit
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {isProfit ? (
                <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Net {isProfit ? 'Profit' : 'Loss'}
                </p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    isProfit
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {fmt(Math.abs(netPnl))}
                </p>
              </div>
            </div>

            <div className="flex gap-4 text-right">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Income</p>
                <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {fmt(summary?.total_income ?? 0)}
                </p>
              </div>
              {(summary?.closing_stock ?? 0) > 0 && (
                <>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Closing Stock</p>
                    <p className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {fmt(summary?.closing_stock ?? 0)}
                    </p>
                  </div>
                </>
              )}
              <div className="w-px bg-gray-200 dark:bg-gray-700" />
              {(summary?.opening_stock ?? 0) > 0 && (
                <>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Opening Stock</p>
                    <p className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {fmt(summary?.opening_stock ?? 0)}
                    </p>
                  </div>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                </>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="font-mono text-sm font-semibold text-red-700 dark:text-red-400">
                  {fmt(summary?.total_expense ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Income & Expense sections */}
          <div className="grid gap-5 xl:grid-cols-2">
            <PnlSection
              title="Income"
              type="income"
              nodes={incomeNodes}
              ledgerTotal={summary?.total_income ?? 0}
              stockValue={summary?.closing_stock ?? 0}
              expandedSet={expandedSet}
              toggleExpand={toggleExpand}
              hideZero={hideZero}
              onLedgerClick={(id, name) => setDrillDown({ id, name })}
            />
            <PnlSection
              title="Expenses"
              type="expense"
              nodes={expenseNodes}
              ledgerTotal={summary?.total_expense ?? 0}
              stockValue={summary?.opening_stock ?? 0}
              expandedSet={expandedSet}
              toggleExpand={toggleExpand}
              hideZero={hideZero}
              onLedgerClick={(id, name) => setDrillDown({ id, name })}
            />
          </div>

          {/* Net P&L bottom row */}
          <div
            className={`flex items-center justify-between rounded-lg border-2 px-5 py-3 ${
              isProfit
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
            }`}
          >
            <span
              className={`font-bold ${
                isProfit
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              Net {isProfit ? 'Profit' : 'Loss'}
              <span className="ml-2 text-xs font-normal opacity-70">
                (Income + Closing Stock) − (Expenses + Opening Stock)
              </span>
            </span>
            <span
              className={`font-mono text-lg font-bold ${
                isProfit
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {fmt(Math.abs(netPnl))}
            </span>
          </div>
        </>
      )}

      {/* Filter Panel */}
      <>
        {filterOpen && (
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setFilterOpen(false)} />
        )}
        <div
          className={`fixed inset-y-0 right-0 z-50 w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
            filterOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
              <button
                onClick={() => setFilterOpen(false)}
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
                    <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">To</label>
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
                onClick={handleReset}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </>

      {/* Ledger Drill-down */}
      {drillDown && (
        <LedgerDrillDownPanel
          ledgerId={drillDown.id}
          ledgerName={drillDown.name}
          dateFrom={appliedDateFrom}
          dateTo={appliedDateTo}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
