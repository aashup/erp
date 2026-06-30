import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi, ledgersApi } from '@/api/accounting';
import { formatCurrency, formatDate, formatTime, localDateToUtcRange } from '@/lib/utils';
import { Filter, Printer } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { SlideSelect } from '@/components/ui/SlideSelect';
import type { Ledger } from '@/types';

function balanceLabel(balance: number): string {
  if (balance === 0) return '0.00';
  return `${formatCurrency(Math.abs(balance))} ${balance >= 0 ? 'Dr' : 'Cr'}`;
}

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

export default function LedgerBook() {
  usePageTitle('Ledger');

  const location = useLocation();
  const initState = location.state as { ledgerId?: string; ledgerName?: string } | null;

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [ledgerId, setLedgerId] = useState(initState?.ledgerId ?? '');
  const [ledgerName, setLedgerName] = useState(initState?.ledgerName ?? '');

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { ledger_id: ledgerId };
    if (appliedDateFrom && appliedDateTo) {
      const { date_from, date_to } = localDateToUtcRange(appliedDateFrom, appliedDateTo);
      p.date_from = date_from;
      p.date_to = date_to;
    }
    return p;
  }, [ledgerId, appliedDateFrom, appliedDateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-ledger-book', ledgerId, appliedDateFrom, appliedDateTo],
    queryFn: () => reportsApi.ledgerTransactions(queryParams),
    select: (res) => res.data,
    enabled: !!ledgerId,
  });

  const ledger = data?.ledger;
  const rows = data?.data ?? [];
  const closingBalance = data?.closing_balance ?? 0;

  const openingBalance = ledger ? ledger.opening_debit - ledger.opening_credit : 0;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const hasFilter = !!(appliedDateFrom || appliedDateTo);

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ledger</h1>
          {ledger && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {ledger.name}{ledger.group_name ? ` · ${ledger.group_name}` : ''}
            </p>
          )}
          {hasFilter && (
            <p className="text-xs text-primary-600 dark:text-primary-400">
              {appliedDateFrom} → {appliedDateTo}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            disabled={!ledgerId}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
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

      {/* Ledger Selector */}
      <div className="print:hidden">
        <SlideSelect
          name="ledger_id"
          label="Select Ledger"
          placeholder="Search and select a ledger..."
          panelTitle="Select Ledger"
          queryKey={['ledgers-slide']}
          queryFn={(params) => ledgersApi.list(params)}
          mapFn={(item: Ledger) => ({ value: item.id, label: item.name })}
          value={ledgerId}
          displayValue={ledgerName}
          onChange={(val, opt) => {
            setLedgerId(val);
            setLedgerName(opt?.label ?? '');
          }}
        />
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">Ledger</h2>
        {ledger && <p className="text-sm">{ledger.name}</p>}
        {appliedDateFrom && appliedDateTo && (
          <p className="text-sm">{appliedDateFrom} to {appliedDateTo}</p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {!ledgerId ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            Select a ledger above to view its account statement.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Voucher No.</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Narration</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Debit</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Credit</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance */}
              {ledger && (
                <tr className="border-b border-gray-100 bg-amber-50/50 dark:border-gray-700/40 dark:bg-amber-900/10">
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">—</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">—</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Opening Balance</td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {ledger.opening_debit > 0 ? formatCurrency(ledger.opening_debit) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {ledger.opening_credit > 0 ? formatCurrency(ledger.opening_credit) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    {balanceLabel(openingBalance)}
                  </td>
                </tr>
              )}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 dark:text-gray-500">
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr
                  key={`${row.voucher_id}-${row.voucher_date}`}
                  className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-700/20"
                >
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    <div>{formatDate(row.voucher_date)}</div>
                    {row.created_at && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(row.created_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{row.voucher_number}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${voucherTypeBadge(row.voucher_type)}`}>
                      {row.voucher_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.narration || '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    {balanceLabel(row.balance)}
                  </td>
                </tr>
              ))}

              {/* Totals */}
              {rows.length > 0 && (
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-700/40">
                  <td colSpan={4} className="px-4 py-2 text-gray-700 dark:text-gray-300">Total</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(totalDebit)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(totalCredit)}</td>
                  <td className="px-4 py-2" />
                </tr>
              )}

              {/* Closing Balance */}
              {ledger && (
                <tr className="border-t border-gray-200 bg-primary-50/50 font-semibold dark:border-gray-700 dark:bg-primary-900/10">
                  <td colSpan={4} className="px-4 py-2 text-gray-700 dark:text-gray-300">Closing Balance</td>
                  <td colSpan={3} className="px-4 py-2 text-right text-primary-700 dark:text-primary-300">
                    {balanceLabel(closingBalance)}
                  </td>
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
