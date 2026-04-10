import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";

export function PayableTaxWidget() {
  const [period, setPeriod] = useState<Period>("this_month");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-tax", period],
    queryFn: () => dashboardApi.stats(period),
    select: (res) => res.data.data,
  });

  const payableTax = stats?.payable_tax ?? 0;
  const isPositive = payableTax >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${isPositive ? "bg-amber-500" : "bg-sky-500"} text-white`}
          >
            <Landmark className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Payable Tax
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
                className={`text-3xl font-bold ${isPositive ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`}
              >
                {formatCurrency(payableTax)}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                GST collected minus input tax credit
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Output {formatCurrency(stats?.gst_output ?? 0)} - ITC{" "}
                {formatCurrency(stats?.gst_input_credit ?? 0)}
              </p>
              {!isPositive && (
                <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                  Input credit exceeds output GST
                </p>
              )}
            </>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {stats?.from} — {stats?.to}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
