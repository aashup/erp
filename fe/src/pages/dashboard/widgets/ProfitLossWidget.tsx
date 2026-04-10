import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { reportsApi } from "@/api/accounting";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";

/**
 * Converts a dashboard period to an ISO date range (matching Carbon's
 * startOfWeek/endOfWeek — Monday to Sunday).
 */
function periodToDateRange(period: Period): { date_from: string; date_to: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (period) {
    case "today":
      return { date_from: fmt(now), date_to: fmt(now) };

    case "this_week": {
      // Carbon startOfWeek = Monday (ISO 8601)
      const day = now.getDay(); // 0=Sun … 6=Sat
      const diffToMon = (day + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { date_from: fmt(mon), date_to: fmt(sun) };
    }

    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { date_from: fmt(first), date_to: fmt(last) };
    }

    case "this_year":
      return {
        date_from: `${now.getFullYear()}-01-01`,
        date_to: `${now.getFullYear()}-12-31`,
      };
  }
}

export function ProfitLossWidget() {
  const [period, setPeriod] = useState<Period>("this_month");
  const { date_from, date_to } = periodToDateRange(period);

  // Use the same P&L report API (voucher-line based) so the number always
  // matches the Profit & Loss report page exactly.
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-pnl", period],
    queryFn: () => reportsApi.profitAndLoss({ date_from, date_to }),
    select: (res) => res.data.summary,
  });

  const isProfit = summary?.is_profit ?? true;
  const netValue = summary?.net_profit_loss ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${isProfit ? "bg-emerald-500" : "bg-red-500"} text-white`}
          >
            <IndianRupee className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Profit & Loss
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="mt-4">
          {isLoading ? (
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ) : (
            <>
              <p
                className={`text-3xl font-bold ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {isProfit ? "+" : ""}
                {formatCurrency(netValue)}
              </p>
              <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Income:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(summary?.total_income ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Closing Stock:</span>
                  <span>+{formatCurrency(summary?.closing_stock ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expense:</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(summary?.total_expense ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Opening Stock:</span>
                  <span>-{formatCurrency(summary?.opening_stock ?? 0)}</span>
                </div>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {date_from} — {date_to}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
