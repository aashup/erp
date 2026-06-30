import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency, periodToDateRange } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";
import { useFYStore } from "@/store/fyStore";
import { useDateStore } from "@/store/dateStore";

function Row({ label, value, colored }: { label: string; value: number; colored?: "green" | "red" }) {
  const cls =
    colored === "green"
      ? "text-green-600 dark:text-green-400"
      : colored === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-600 dark:text-gray-400";
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cls}>{formatCurrency(value)}</span>
    </div>
  );
}

export function TotalSalesWidget() {
  const [period, setPeriod] = useState<Period>("this_year");
  const selectedFY = useFYStore((s) => s.selectedFY);
  const selectedDate = useDateStore((s) => s.selectedDate);
  const { date_from, date_to } = periodToDateRange(period, selectedDate, selectedFY);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-sales", date_from, date_to],
    queryFn: () => dashboardApi.stats({ date_from, date_to }),
    select: (res) => res.data.data,
  });

  const hasIgst = (stats?.sales_igst ?? 0) > 0;
  const totalGst = (stats?.sales_cgst ?? 0) + (stats?.sales_sgst ?? 0) + (stats?.sales_igst ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Sales</h3>
        </div>
      </CardHeader>
      <CardContent>
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="mt-4">
          {isLoading ? (
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ) : (
            <>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(stats?.total_sales ?? 0)}
              </p>

              <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <Row label="Taxable"  value={stats?.sales_taxable ?? 0} colored="green" />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-1" />
                {hasIgst ? (
                  <Row label="IGST" value={stats?.sales_igst ?? 0} colored="red" />
                ) : (
                  <>
                    <Row label="CGST" value={stats?.sales_cgst ?? 0} colored="red" />
                    <Row label="SGST" value={stats?.sales_sgst ?? 0} colored="red" />
                  </>
                )}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                  <Row label="Total GST" value={totalGst} colored="red" />
                </div>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {stats?.from} — {stats?.to}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
