import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";
import { useFYStore } from "@/store/fyStore";

function Row({
  label,
  value,
  colored,
}: {
  label: string;
  value: number;
  colored?: "orange" | "red";
}) {
  const cls =
    colored === "orange"
      ? "text-orange-600 dark:text-orange-400"
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

export function TotalPurchaseWidget() {
  const [period, setPeriod] = useState<Period>("this_year");
  const selectedFY = useFYStore((s) => s.selectedFY);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-purchase", period, selectedFY?.id],
    queryFn: () => dashboardApi.stats(period),
    select: (res) => res.data.data,
  });

  const hasIgst = (stats?.purchase_igst ?? 0) > 0;
  const totalGst =
    (stats?.purchase_cgst ?? 0) +
    (stats?.purchase_sgst ?? 0) +
    (stats?.purchase_igst ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Total Purchase
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
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(stats?.total_purchase ?? 0)}
              </p>

              <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <Row label="Taxable" value={stats?.purchase_taxable ?? 0} colored="orange" />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-1" />
                {hasIgst ? (
                  <Row label="IGST (ITC)" value={stats?.purchase_igst ?? 0} colored="red" />
                ) : (
                  <>
                    <Row label="CGST (ITC)" value={stats?.purchase_cgst ?? 0} colored="red" />
                    <Row label="SGST (ITC)" value={stats?.purchase_sgst ?? 0} colored="red" />
                  </>
                )}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                  <Row label="Total ITC" value={totalGst} colored="red" />
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
