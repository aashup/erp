import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";
import { useFYStore } from "@/store/fyStore";

function Row({
  label,
  value,
  sign,
  bold,
}: {
  label: string;
  value: number;
  sign?: "+" | "-";
  bold?: boolean;
}) {
  const color =
    sign === "+"
      ? "text-emerald-600 dark:text-emerald-400"
      : sign === "-"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-700 dark:text-gray-200";

  return (
    <div className={`flex justify-between text-xs ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={color}>
        {sign === "-" ? "-" : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function NetRevenueWidget() {
  const [period, setPeriod] = useState<Period>("this_year");
  const selectedFY = useFYStore((s) => s.selectedFY);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-net-revenue", period, selectedFY?.id],
    queryFn: () => dashboardApi.stats(period),
    select: (res) => res.data.data,
  });

  const hasIgst = (stats?.sales_igst ?? 0) > 0;
  const totalGst =
    (stats?.sales_cgst ?? 0) + (stats?.sales_sgst ?? 0) + (stats?.sales_igst ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Receipt className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Net Revenue</h3>
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
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Sales amount excluding GST
              </p>

              <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <Row label="Total Sales" value={stats?.total_sales ?? 0} sign="+" />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-1" />
                {hasIgst ? (
                  <Row label="Less IGST" value={stats?.sales_igst ?? 0} sign="-" />
                ) : (
                  <>
                    <Row label="Less CGST" value={stats?.sales_cgst ?? 0} sign="-" />
                    <Row label="Less SGST" value={stats?.sales_sgst ?? 0} sign="-" />
                  </>
                )}
                <Row label="Total GST" value={totalGst} sign="-" />
                <div className="border-t border-gray-200 dark:border-gray-700 pt-1">
                  <Row label="Net Revenue" value={stats?.net_revenue ?? 0} sign="+" bold />
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
