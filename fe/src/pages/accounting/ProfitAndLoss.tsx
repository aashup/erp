import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/accounting';
import { TrendingUp, TrendingDown } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ProfitAndLoss() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-profit-and-loss'],
    queryFn: () => reportsApi.profitAndLoss(),
    select: (res) => res.data.data,
  });

  const income = data?.income;
  const expense = data?.expense;
  const netPnl = data?.net_profit_loss ?? 0;
  const isProfit = data?.is_profit ?? true;

  const hasData = (income?.items?.length ?? 0) > 0 || (expense?.items?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profit & Loss Statement</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Income vs Expenses for the selected financial year
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : !hasData ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No income or expense entries found. Create some transactions to see the P&L statement.
          </p>
        </div>
      ) : (
        <>
          {/* Net P&L Card */}
          <div
            className={`rounded-xl border-2 p-6 text-center ${
              isProfit
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              {isProfit ? (
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {isProfit ? 'Net Profit' : 'Net Loss'}
                </p>
                <p
                  className={`text-3xl font-bold ${
                    isProfit
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {formatCurrency(Math.abs(netPnl))}
                </p>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Income Side */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 bg-emerald-50 px-4 py-3 dark:border-gray-700 dark:bg-emerald-900/20">
                <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                  Income
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {income?.items && income.items.length > 0 ? (
                  income.items.map((item) => (
                    <div
                      key={item.account_id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        {/* <p className="text-xs text-gray-500 dark:text-gray-400">{item.code}</p> */}
                      </div>
                      <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    No income entries
                  </div>
                )}
              </div>
              <div className="border-t-2 border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Total Income
                  </p>
                  <p className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-300">
                    {formatCurrency(income?.total ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expense Side */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 bg-red-50 px-4 py-3 dark:border-gray-700 dark:bg-red-900/20">
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">Expenses</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {expense?.items && expense.items.length > 0 ? (
                  expense.items.map((item) => (
                    <div
                      key={item.account_id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        {/* <p className="text-xs text-gray-500 dark:text-gray-400">{item.code}</p> */}
                      </div>
                      <p className="font-mono font-semibold text-red-700 dark:text-red-300">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    No expense entries
                  </div>
                )}
              </div>
              <div className="border-t-2 border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-red-800 dark:text-red-300">Total Expenses</p>
                  <p className="text-lg font-bold font-mono text-red-800 dark:text-red-300">
                    {formatCurrency(expense?.total ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
