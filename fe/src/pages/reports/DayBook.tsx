import { Fragment, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi } from '@/api/accounting';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Filter, Printer, ChevronRight, ChevronDown } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

function voucherTypeBadge(type: string): string {
  const map: Record<string, string> = {
    receipt: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    payment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    contra: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    journal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    sales: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    purchase: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return map[type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export default function DayBook() {
  usePageTitle('Day Book');

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (appliedDateFrom) p.date_from = appliedDateFrom;
    if (appliedDateTo) p.date_to = appliedDateTo;
    return p;
  }, [appliedDateFrom, appliedDateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-day-book', appliedDateFrom, appliedDateTo],
    queryFn: () => reportsApi.dayBook(queryParams),
    select: (res) => res.data,
  });

  const entries = data?.data ?? [];
  const summary = data?.summary;
  const hasFilter = !!(appliedDateFrom || appliedDateTo);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(entries.map((e) => e.voucher_id)));
  const collapseAll = () => setExpandedIds(new Set());

  const handleApply = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setShowFilterPanel(false);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Day Book</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">All vouchers — day-wise register</p>
          {hasFilter && (
            <p className="text-xs text-primary-600 dark:text-primary-400">
              {appliedDateFrom} → {appliedDateTo}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={() => setShowFilterPanel(true)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              hasFilter
                ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/20 dark:text-primary-300'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters{hasFilter ? ' (1)' : ''}
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">Day Book</h2>
        {appliedDateFrom && appliedDateTo && (
          <p className="text-sm">{appliedDateFrom} to {appliedDateTo}</p>
        )}
      </div>

      {/* Expand/Collapse Controls */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 text-sm print:hidden">
          <span className="text-gray-500 dark:text-gray-400">{entries.length} voucher(s)</span>
          <button onClick={expandAll} className="text-primary-600 hover:underline dark:text-primary-400">
            Expand All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button onClick={collapseAll} className="text-primary-600 hover:underline dark:text-primary-400">
            Collapse All
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            No vouchers in this period.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Voucher No.</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Narration</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Debit</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isExpanded = expandedIds.has(entry.voucher_id);
                return (
                  <Fragment key={entry.voucher_id}>
                    {/* Voucher Header Row */}
                    <tr
                      onClick={() => toggleExpand(entry.voucher_id)}
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-700/20"
                    >
                      <td className="px-4 py-2 text-gray-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        <div>{formatDate(entry.voucher_date)}</div>
                        {entry.created_at && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTime(entry.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{entry.voucher_number}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${voucherTypeBadge(entry.voucher_type)}`}>
                          {entry.voucher_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{entry.narration || '—'}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        {entry.total_debit > 0 ? formatCurrency(entry.total_debit) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        {entry.total_credit > 0 ? formatCurrency(entry.total_credit) : '—'}
                      </td>
                    </tr>

                    {/* Expanded Lines */}
                    {isExpanded &&
                      entry.lines.map((line, i) => (
                        <tr
                          key={`${entry.voucher_id}-line-${i}`}
                          className="border-b border-gray-100/60 bg-gray-50/50 dark:border-gray-700/20 dark:bg-gray-800/60"
                        >
                          <td className="px-4 py-1.5" />
                          <td className="px-4 py-1.5" />
                          <td className="px-4 py-1.5" />
                          <td className="px-4 py-1.5" />
                          <td className="py-1.5 pl-10 pr-4 text-gray-700 dark:text-gray-300">
                            {line.ledger_name}
                            {line.narration && (
                              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">— {line.narration}</span>
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-400">
                            {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                          </td>
                          <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-400">
                            {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}

              {/* Grand Total */}
              {summary && (
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-700/40">
                  <td colSpan={5} className="px-4 py-2 text-gray-700 dark:text-gray-300">Grand Total</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(summary.total_debit)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(summary.total_credit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Filter Panel */}
      <FilterPanel open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
      </FilterPanel>
    </div>
  );
}
