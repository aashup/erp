import { Fragment, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi } from '@/api/accounting';
import type { TrialBalanceRow } from '@/types';
import { ChevronRight, ChevronDown, Filter, X, FolderOpen, FileText, ArrowLeft } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];

const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

const TYPE_BG: Record<string, string> = {
  asset: 'bg-blue-50 dark:bg-blue-950/30',
  liability: 'bg-purple-50 dark:bg-purple-950/30',
  equity: 'bg-green-50 dark:bg-green-950/30',
  income: 'bg-emerald-50 dark:bg-emerald-950/30',
  expense: 'bg-red-50 dark:bg-red-950/30',
};

const TYPE_TEXT: Record<string, string> = {
  asset: 'text-blue-700 dark:text-blue-400',
  liability: 'text-purple-700 dark:text-purple-400',
  equity: 'text-green-700 dark:text-green-400',
  income: 'text-emerald-700 dark:text-emerald-400',
  expense: 'text-red-700 dark:text-red-400',
};

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

interface TreeNode {
  row: TrialBalanceRow;
  children: TreeNode[];
  agg: Agg; // aggregated from all descendant ledgers
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

function rowToAgg(row: TrialBalanceRow): Agg {
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

function sortRows(arr: TrialBalanceRow[]): TrialBalanceRow[] {
  return [...arr].sort((a, b) => {
    if (a.is_group !== b.is_group) return a.is_group ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function buildTree(rows: TrialBalanceRow[]): Map<string, TreeNode[]> {
  const childrenOf = new Map<string | null, TrialBalanceRow[]>();
  rows.forEach((r) => {
    const k = r.parent_id ?? null;
    if (!childrenOf.has(k)) childrenOf.set(k, []);
    childrenOf.get(k)!.push(r);
  });

  function makeNode(row: TrialBalanceRow): TreeNode {
    const kids = sortRows(childrenOf.get(row.account_id) ?? []).map(makeNode);
    const agg = row.is_group
      ? kids.reduce((acc, c) => addAgg(acc, c.agg), { ...ZERO })
      : rowToAgg(row);
    return { row, children: kids, agg };
  }

  const byType = new Map<string, TreeNode[]>();
  for (const r of sortRows(childrenOf.get(null) ?? [])) {
    const node = makeNode(r);
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type)!.push(node);
  }
  return byType;
}

// ─── CollapsibleRow ───────────────────────────────────────────────────────────

interface RowProps {
  node: TreeNode;
  depth: number;
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZero: boolean;
  onLedgerClick: (id: string, name: string) => void;
}

function CollapsibleRow({
  node,
  depth,
  expandedSet,
  toggleExpand,
  hideZero,
  onLedgerClick,
}: RowProps) {
  const { row, children, agg } = node;
  const isGroup = row.is_group;
  const isExpanded = expandedSet.has(row.account_id);

  if (hideZero && !isNonZero(agg)) return null;

  const pl = 12 + depth * 20;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/40 ${
          isGroup
            ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20'
            : 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10'
        } ${depth === 0 && isGroup ? 'bg-gray-50/60 dark:bg-gray-800/40' : ''}`}
        onClick={() =>
          isGroup ? toggleExpand(row.account_id) : onLedgerClick(row.account_id, row.name)
        }
      >
        {/* Name */}
        <td className="py-2 pr-3" style={{ paddingLeft: pl }}>
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
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2'
              }`}
            >
              {row.name}
            </span>
          </div>
        </td>

        {/* Opening Dr */}
        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400 dark:text-gray-500">
          {fmt(agg.opening_debit)}
        </td>
        {/* Opening Cr */}
        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400 dark:text-gray-500">
          {fmt(agg.opening_credit)}
        </td>
        {/* Debit (transactions) */}
        <td
          className={`px-3 py-2 text-right font-mono text-sm ${
            isGroup
              ? 'font-semibold text-blue-700 dark:text-blue-300'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {fmt(agg.txn_debit)}
        </td>
        {/* Credit (transactions) */}
        <td
          className={`px-3 py-2 text-right font-mono text-sm ${
            isGroup
              ? 'font-semibold text-red-700 dark:text-red-300'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {fmt(agg.txn_credit)}
        </td>
        {/* Closing Dr */}
        <td
          className={`px-3 py-2 text-right font-mono text-sm ${
            isGroup
              ? 'font-bold text-gray-800 dark:text-gray-100'
              : 'font-medium text-gray-700 dark:text-gray-300'
          }`}
        >
          {fmt(agg.closing_debit)}
        </td>
        {/* Closing Cr */}
        <td
          className={`px-3 py-2 text-right font-mono text-sm ${
            isGroup
              ? 'font-bold text-gray-800 dark:text-gray-100'
              : 'font-medium text-gray-700 dark:text-gray-300'
          }`}
        >
          {fmt(agg.closing_credit)}
        </td>
      </tr>

      {isExpanded &&
        children.map((child) => (
          <CollapsibleRow
            key={child.row.account_id}
            node={child}
            depth={depth + 1}
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

        {/* Closing balance bar */}
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
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
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
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">From</label>
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

export default function TrialBalance() {
  usePageTitle('Trial Balance');

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
    queryKey: ['report-trial-balance', appliedDateFrom, appliedDateTo],
    queryFn: () => reportsApi.trialBalance(queryParams),
    select: (res) => res.data,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;
  const treeByType = useMemo(() => buildTree(rows), [rows]);

  // Grand totals aggregated from all tree nodes
  const grandTotals = useMemo(() => {
    let agg = { ...ZERO };
    for (const type of TYPE_ORDER) {
      for (const n of treeByType.get(type) ?? []) {
        agg = addAgg(agg, n.agg);
      }
    }
    return agg;
  }, [treeByType]);

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.row.is_group) {
          ids.add(n.row.account_id);
          collect(n.children);
        }
      }
    }
    treeByType.forEach((nodes) => collect(nodes));
    setExpandedSet(ids);
  }, [treeByType]);

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

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trial Balance</h1>
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
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No accounts found. Set up your chart of accounts and post some transactions.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Column header */}
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                    Particulars
                  </th>
                  {/* Opening group header */}
                  <th
                    colSpan={2}
                    className="border-l border-gray-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  >
                    Opening Balance
                  </th>
                  {/* Transaction group header */}
                  <th
                    colSpan={2}
                    className="border-l border-gray-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  >
                    Transactions
                  </th>
                  {/* Closing group header */}
                  <th
                    colSpan={2}
                    className="border-l border-gray-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    Closing Balance
                  </th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-3 pb-2.5 pt-0 text-left text-xs text-gray-400 dark:text-gray-500">
                    Account
                  </th>
                  <th className="w-32 border-l border-gray-200 px-3 pb-2.5 pt-0 text-right text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Dr
                  </th>
                  <th className="w-32 px-3 pb-2.5 pt-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Cr
                  </th>
                  <th className="w-32 border-l border-gray-200 px-3 pb-2.5 pt-0 text-right text-xs font-semibold text-blue-600 dark:border-gray-700 dark:text-blue-400">
                    Dr
                  </th>
                  <th className="w-32 px-3 pb-2.5 pt-0 text-right text-xs font-semibold text-red-600 dark:text-red-400">
                    Cr
                  </th>
                  <th className="w-36 border-l border-gray-200 px-3 pb-2.5 pt-0 text-right text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Dr
                  </th>
                  <th className="w-36 px-3 pb-2.5 pt-0 text-right text-xs font-bold text-gray-700 dark:text-gray-200">
                    Cr
                  </th>
                </tr>
              </thead>

              <tbody>
                {TYPE_ORDER.map((type) => {
                  const nodes = treeByType.get(type);
                  if (!nodes?.length) return null;

                  const typeAgg = nodes.reduce((acc, n) => addAgg(acc, n.agg), { ...ZERO });
                  if (hideZero && !isNonZero(typeAgg)) return null;

                  return (
                    <Fragment key={type}>
                      {/* Type section header row */}
                      <tr className={`border-b border-gray-200 dark:border-gray-700 ${TYPE_BG[type]}`}>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${TYPE_TEXT[type]}`}
                          >
                            {TYPE_LABELS[type]}
                          </span>
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2 text-right font-mono text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          {fmt(typeAgg.opening_debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-500 dark:text-gray-400">
                          {fmt(typeAgg.opening_credit)}
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2 text-right font-mono text-xs font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-300">
                          {fmt(typeAgg.txn_debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-red-700 dark:text-red-300">
                          {fmt(typeAgg.txn_credit)}
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2 text-right font-mono text-xs font-bold text-gray-800 dark:border-gray-700 dark:text-gray-100">
                          {fmt(typeAgg.closing_debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-gray-800 dark:text-gray-100">
                          {fmt(typeAgg.closing_credit)}
                        </td>
                      </tr>

                      {/* Tree rows */}
                      {nodes.map((node) => (
                        <CollapsibleRow
                          key={node.row.account_id}
                          node={node}
                          depth={0}
                          expandedSet={expandedSet}
                          toggleExpand={toggleExpand}
                          hideZero={hideZero}
                          onLedgerClick={(id, name) => setDrillDown({ id, name })}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>

              {/* Grand Total Footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-900">
                  <td className="px-3 py-3 text-sm font-bold text-gray-800 dark:text-gray-100">
                    Grand Total
                  </td>
                  <td className="border-l border-gray-300 px-3 py-3 text-right font-mono text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
                    {fmt(grandTotals.opening_debit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                    {fmt(grandTotals.opening_credit)}
                  </td>
                  <td className="border-l border-gray-300 px-3 py-3 text-right font-mono text-sm font-bold text-blue-800 dark:border-gray-600 dark:text-blue-200">
                    {fmt(grandTotals.txn_debit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold text-red-800 dark:text-red-200">
                    {fmt(grandTotals.txn_credit)}
                  </td>
                  <td className="border-l border-gray-300 px-3 py-3 text-right font-mono text-sm font-bold text-gray-900 dark:border-gray-600 dark:text-gray-100">
                    {fmt(grandTotals.closing_debit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                    {fmt(grandTotals.closing_credit)}
                  </td>
                </tr>
                {summary && (
                  <tr
                    className={
                      summary.difference === 0
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-amber-50 dark:bg-amber-900/20'
                    }
                  >
                    <td
                      colSpan={7}
                      className={`px-3 py-2 text-center text-xs font-semibold ${
                        summary.difference === 0
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {summary.difference === 0
                        ? '✓ Trial Balance tallies — Total Debit = Total Credit'
                        : `⚠ Difference: ${fmt(Math.abs(summary.difference))} (${summary.difference > 0 ? 'Dr' : 'Cr'} side exceeds)`}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Filter Panel */}
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
