import { Fragment, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi } from '@/api/accounting';
import type { TrialBalanceRow } from '@/types';
import {
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  FolderOpen,
  FileText,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(amount: number) {
  if (amount === 0) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

const TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-700 dark:text-blue-400',
  liability: 'text-purple-700 dark:text-purple-400',
  equity: 'text-green-700 dark:text-green-400',
  income: 'text-emerald-700 dark:text-emerald-400',
  expense: 'text-red-700 dark:text-red-400',
};

const TYPE_BG: Record<string, string> = {
  asset: 'bg-blue-50 dark:bg-blue-900/20',
  liability: 'bg-purple-50 dark:bg-purple-900/20',
  equity: 'bg-green-50 dark:bg-green-900/20',
  income: 'bg-emerald-50 dark:bg-emerald-900/20',
  expense: 'bg-red-50 dark:bg-red-900/20',
};

// ---------------------------------------------------------------------------
// Tree node type
// ---------------------------------------------------------------------------

interface TreeNode {
  row: TrialBalanceRow;
  children: TreeNode[];
  // Aggregated totals including all descendants
  aggClosingDebit: number;
  aggClosingCredit: number;
}

function buildTree(rows: TrialBalanceRow[]): Map<string, TreeNode[]> {
  const rowMap = new Map<string, TrialBalanceRow>();
  rows.forEach((r) => rowMap.set(r.account_id, r));

  // Build adjacency: parent_id → children
  const childrenOf = new Map<string | 'root', TrialBalanceRow[]>();
  rows.forEach((r) => {
    const key = r.parent_id ?? 'root';
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(r);
  });

  // Recursively build tree nodes
  function makeNode(row: TrialBalanceRow): TreeNode {
    const kids = (childrenOf.get(row.account_id) ?? []).map(makeNode);
    const ownDr = row.closing_debit;
    const ownCr = row.closing_credit;
    const kidsDr = kids.reduce((s, k) => s + k.aggClosingDebit, 0);
    const kidsCr = kids.reduce((s, k) => s + k.aggClosingCredit, 0);
    return {
      row,
      children: kids,
      aggClosingDebit: ownDr + kidsDr,
      aggClosingCredit: ownCr + kidsCr,
    };
  }

  // Group root nodes by type
  const roots = childrenOf.get('root') ?? [];
  const byType = new Map<string, TreeNode[]>();
  for (const r of roots) {
    const node = makeNode(r);
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type)!.push(node);
  }
  return byType;
}

function hasNonZeroBalance(node: TreeNode): boolean {
  if (node.row.closing_debit !== 0 || node.row.closing_credit !== 0) return true;
  return node.children.some(hasNonZeroBalance);
}

// ---------------------------------------------------------------------------
// CollapsibleRow component
// ---------------------------------------------------------------------------

interface RowProps {
  node: TreeNode;
  depth: number;
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideZeroGroups: boolean;
  hideZeroLedgers: boolean;
}

function CollapsibleRow({
  node,
  depth,
  expandedSet,
  toggleExpand,
  hideZeroGroups,
  hideZeroLedgers,
}: RowProps) {
  const { row, children } = node;
  const isGroup = children.length > 0 || row.is_group;
  const isExpanded = expandedSet.has(row.account_id);
  const isZero =
    row.closing_debit === 0 && row.closing_credit === 0 && node.aggClosingDebit === 0 && node.aggClosingCredit === 0;

  // Apply hide filters
  if (isGroup && hideZeroGroups && !hasNonZeroBalance(node)) return null;
  if (!isGroup && hideZeroLedgers && isZero) return null;

  const paddingLeft = 16 + depth * 24;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/50 ${
          isGroup
            ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
            : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
        } ${depth === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
        onClick={isGroup ? () => toggleExpand(row.account_id) : undefined}
        style={{ cursor: isGroup ? 'pointer' : 'default' }}
      >
        {/* Account name with indent & toggle */}
        <td className="py-2.5 pr-4" style={{ paddingLeft }}>
          <div className="flex items-center gap-2">
            {isGroup ? (
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-500 dark:text-gray-400">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}
            {isGroup ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
            ) : (
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            )}
            <span
              className={`truncate ${
                isGroup
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {row.name}
            </span>
            {/* <span className="ml-1 font-mono text-[10px] text-gray-400 dark:text-gray-500">
              {row.code}
            </span> */}
          </div>
        </td>

        {/* Closing Debit */}
        <td className="px-4 py-2.5 text-right font-mono text-sm">
          {isGroup && !isExpanded ? (
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {fmt(node.aggClosingDebit)}
            </span>
          ) : (
            <span className={isGroup ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-blue-600 dark:text-blue-400'}>
              {fmt(row.closing_debit)}
            </span>
          )}
        </td>

        {/* Closing Credit */}
        <td className="px-4 py-2.5 text-right font-mono text-sm">
          {isGroup && !isExpanded ? (
            <span className="font-semibold text-red-700 dark:text-red-300">
              {fmt(node.aggClosingCredit)}
            </span>
          ) : (
            <span className={isGroup ? 'font-semibold text-red-700 dark:text-red-300' : 'text-red-600 dark:text-red-400'}>
              {fmt(row.closing_credit)}
            </span>
          )}
        </td>
      </tr>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <CollapsibleRow
            key={child.row.account_id}
            node={child}
            depth={depth + 1}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            hideZeroGroups={hideZeroGroups}
            hideZeroLedgers={hideZeroLedgers}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter Panel (right slide-over)
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  hideZeroGroups: boolean;
  setHideZeroGroups: (v: boolean) => void;
  hideZeroLedgers: boolean;
  setHideZeroLedgers: (v: boolean) => void;
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
  hideZeroGroups,
  setHideZeroGroups,
  hideZeroLedgers,
  setHideZeroLedgers,
  onApply,
  onReset,
}: FilterPanelProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}
      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Date Range */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Override FY dates. Leave empty to use selected Financial Year.
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

            {/* Visibility */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visibility
              </label>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={hideZeroGroups}
                    onChange={(e) => setHideZeroGroups(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Hide zero-balance groups
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Hide groups where all children have zero balance
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={hideZeroLedgers}
                    onChange={(e) => setHideZeroLedgers(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Hide zero-balance ledgers
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Hide individual accounts with no activity
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TrialBalance() {
  usePageTitle('Trial Balance');
  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [hideZeroGroups, setHideZeroGroups] = useState(true);
  const [hideZeroLedgers, setHideZeroLedgers] = useState(true);

  // Expand/collapse state
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((nodesByType: Map<string, TreeNode[]>) => {
    const ids = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0 || n.row.is_group) ids.add(n.row.account_id);
        collect(n.children);
      }
    }
    nodesByType.forEach((nodes) => collect(nodes));
    setExpandedSet(ids);
  }, []);

  const collapseAll = useCallback(() => setExpandedSet(new Set()), []);

  // Build query params
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

  const rows: TrialBalanceRow[] = data?.data ?? [];
  const summary = data?.summary;

  // Build the tree grouped by type
  const treeByType = useMemo(() => buildTree(rows), [rows]);

  const typeOrder: string[] = ['asset', 'liability', 'equity', 'income', 'expense'];

  // Check if any filters active
  const hasActiveFilters = appliedDateFrom || appliedDateTo || !hideZeroGroups || !hideZeroLedgers;

  // Filter handlers
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
    setHideZeroGroups(true);
    setHideZeroLedgers(true);
    setFilterOpen(false);
  };

  // Compute visible totals (only from accounts actually visible at root level)
  const visibleTotals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const type of typeOrder) {
      const nodes = treeByType.get(type) ?? [];
      for (const n of nodes) {
        if (hideZeroGroups && !hasNonZeroBalance(n)) continue;
        dr += n.aggClosingDebit;
        cr += n.aggClosingCredit;
      }
    }
    return { dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100 };
  }, [treeByType, hideZeroGroups]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trial Balance</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Collapsible account tree for the selected financial year
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => expandAll(treeByType)}
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
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              hasActiveFilters
                ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active date filter indicator */}
      {(appliedDateFrom || appliedDateTo) && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className="font-medium text-indigo-700 dark:text-indigo-300">
            Custom date range:
          </span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {appliedDateFrom || '...'} to {appliedDateTo || '...'}
          </span>
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setAppliedDateFrom('');
              setAppliedDateTo('');
            }}
            className="ml-auto text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
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
          <p className="text-gray-500 dark:text-gray-400">
            No transactions found. Create some invoices or journal entries to see the trial balance.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Account
                  </th>
                  <th className="w-44 px-4 py-3 text-right font-semibold text-blue-700 dark:text-blue-400">
                    Debit (Dr)
                  </th>
                  <th className="w-44 px-4 py-3 text-right font-semibold text-red-700 dark:text-red-400">
                    Credit (Cr)
                  </th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map((type) => {
                  const nodes = treeByType.get(type);
                  if (!nodes || nodes.length === 0) return null;

                  // Check if entire type group is zero
                  const typeHasBalance = nodes.some(hasNonZeroBalance);
                  if (hideZeroGroups && !typeHasBalance) return null;

                  // Aggregate type totals
                  const typeDr = nodes.reduce((s, n) => s + n.aggClosingDebit, 0);
                  const typeCr = nodes.reduce((s, n) => s + n.aggClosingCredit, 0);

                  return (
                    <Fragment key={type}>
                      {/* Type section header */}
                      <tr className={`border-b border-gray-200 dark:border-gray-700 ${TYPE_BG[type]}`}>
                        <td className="px-4 py-2.5">
                          <span className={`text-sm font-bold uppercase tracking-wide ${TYPE_COLORS[type]}`}>
                            {TYPE_LABELS[type]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-blue-700 dark:text-blue-300">
                          {fmt(typeDr)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-red-700 dark:text-red-300">
                          {fmt(typeCr)}
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
                          hideZeroGroups={hideZeroGroups}
                          hideZeroLedgers={hideZeroLedgers}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              {/* Grand Total */}
              {summary && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold dark:border-gray-600 dark:bg-gray-900">
                    <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">
                      GRAND TOTAL
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-800 dark:text-blue-200">
                      {fmt(summary.total_debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-800 dark:text-red-200">
                      {fmt(summary.total_credit)}
                    </td>
                  </tr>
                  {summary.difference === 0 ? (
                    <tr className="bg-green-50 dark:bg-green-900/20">
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-center text-xs font-medium text-green-700 dark:text-green-300"
                      >
                        Trial Balance tallies perfectly
                      </td>
                    </tr>
                  ) : (
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Opening Difference
                      </td>
                      {summary.difference > 0 ? (
                        <>
                          <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                            {fmt(Math.abs(summary.difference))} Dr
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">
                            -
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">
                            -
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-red-700 dark:text-red-300">
                            {fmt(Math.abs(summary.difference))} Cr
                          </td>
                        </>
                      )}
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Filter slide-over panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        hideZeroGroups={hideZeroGroups}
        setHideZeroGroups={setHideZeroGroups}
        hideZeroLedgers={hideZeroLedgers}
        setHideZeroLedgers={setHideZeroLedgers}
        onApply={handleApply}
        onReset={handleReset}
      />
    </div>
  );
}
