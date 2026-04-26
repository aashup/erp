import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";
import { useFYStore } from "@/store/fyStore";

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(value)}</span>
    </div>
  );
}

export function CollectionWidget() {
  const [period, setPeriod] = useState<Period>("today");
  const selectedFY = useFYStore((s) => s.selectedFY);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-collection", period, selectedFY?.id],
    queryFn: () => dashboardApi.collection(period),
    select: (res) => res.data.data,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Collection</h3>
        </div>
      </CardHeader>
      <CardContent>
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="mt-4">
          {isLoading ? (
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(stats?.total ?? 0)}
              </p>
              <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <Row label="In Account" value={stats?.account ?? 0} />
                <Row label="In Cash" value={stats?.cash ?? 0} />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Need to Collect</span>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                    {formatCurrency(stats?.need_to_collect ?? 0)}
                  </span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Total Sale</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      {formatCurrency((stats?.cash ?? 0) + (stats?.account ?? 0) + (stats?.need_to_collect ?? 0))}
                    </span>
                  </div>
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
