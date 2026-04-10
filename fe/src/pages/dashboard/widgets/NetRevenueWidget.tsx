import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";

export function NetRevenueWidget() {
  const [period, setPeriod] = useState<Period>("this_month");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-net-revenue", period],
    queryFn: () => dashboardApi.stats(period),
    select: (res) => res.data.data,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Receipt className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Net Revenue
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
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stats?.net_revenue ?? 0)}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Actual earnings after removing GST from sales
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Sales {formatCurrency(stats?.total_sales ?? 0)} - GST{" "}
                {formatCurrency(stats?.gst_output ?? 0)}
              </p>
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
