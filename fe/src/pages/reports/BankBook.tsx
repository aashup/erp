import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportsApi } from '@/api/accounting';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Filter, Printer } from 'lucide-react';
import { FilterPanel } from '@/components/ui/FilterPanel';

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

export default function BankBook() {
  usePageTitle('Bank Book');

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (appliedDateFrom) p.date_from = appliedDateFrom;
    if (appliedDateTo) p.date_to = appliedDateTo;
    if (selectedBankId) p.ledger_id = selectedBankId;
    return p;
  }, [appliedDateFrom, appliedDateTo, selectedBankId]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-bank-book', appliedDateFrom, appliedDateTo, selectedBankId],
    queryFn: () => reportsApi.bankBook(queryParams),
    select: (res) => res.data,
  });

  const banks = data?.banks ?? [];
  const selectedLedger = data?.selected_ledger;
  const rows = data?.data ?? [];
  const closingBalance = data?.closing_balance ?? 0;

  const openingBalance = selectedLedger ? selectedLedger.opening_debit - selectedLedger.opening_credit : 0;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  const activeFilterCount = [appliedDateFrom, appliedDateTo, selectedBankId].filter(Boolean).length;
  const hasFilter = activeFilterCount > 0;

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
    setSelectedBankId('');
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bank Book</h1>
          {selectedLedger && <p className="text-sm text-gray-500 dark:text-gray-400">{selectedLedger.name}</p>}
          {appliedDateFrom && appliedDateTo && (
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
            Filters{hasFilter ? ` (${activeFilterCount > 2 ? activeFilterCount - 1 : activeFilterCount === 2 ? 1 : 0})` : ''}
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">Bank Book</h2>
        {selectedLedger && <p className="text-sm">{selectedLedger.name}</p>}
        {appliedDateFrom && appliedDateTo && (
          <p className="text-sm">{appliedDateFrom} to {appliedDateTo}</p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">Loading...</div>
        ) : banks.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            No bank accounts found. Add bank ledgers under the Bank Accounts group.
          </div>
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
              {selectedLedger && (
                <tr className="border-b border-gray-100 bg-amber-50/50 dark:border-gray-700/40 dark:bg-amber-900/10">
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">—</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">—</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Opening Balance</td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {selectedLedger.opening_debit > 0 ? formatCurrency(selectedLedger.opening_debit) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {selectedLedger.opening_credit > 0 ? formatCurrency(selectedLedger.opening_credit) : '—'}
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
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatDate(row.voucher_date)}</td>
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
              <tr className="border-t border-gray-200 bg-primary-50/50 font-semibold dark:border-gray-700 dark:bg-primary-900/10">
                <td colSpan={4} className="px-4 py-2 text-gray-700 dark:text-gray-300">Closing Balance</td>
                <td colSpan={3} className="px-4 py-2 text-right text-primary-700 dark:text-primary-300">
                  {balanceLabel(closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Filter Panel */}
      <FilterPanel open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
        {/* Bank Account Selector */}
        {banks.length > 1 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account</label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
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
