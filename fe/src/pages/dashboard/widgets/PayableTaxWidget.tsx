import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { PeriodFilter, type Period } from "./PeriodFilter";

function GstRow({
  label,
  output,
  itc,
}: {
  label: string;
  output: number;
  itc: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(output)}</span>
      <span className="text-right text-sky-600 dark:text-sky-400">{formatCurrency(itc)}</span>
    </div>
  );
}

export function PayableTaxWidget() {
  const [period, setPeriod] = useState<Period>("this_month");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-tax", period],
    queryFn: () => dashboardApi.stats(period),
    select: (res) => res.data.data,
  });

  const payableTax = stats?.payable_tax ?? 0;
  const isPositive = payableTax >= 0;

  const hasIgst =
    (stats?.gst_output_igst ?? 0) > 0 || (stats?.gst_input_igst ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${isPositive ? "bg-amber-500" : "bg-sky-500"} text-white`}
          >
            <Landmark className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payable Tax</h3>
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
                {formatCurrency(Math.abs(payableTax))}
              </p>
              {!isPositive && (
                <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                  ITC exceeds output — carry forward
                </p>
              )}

              {/* Summary row */}
              <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Output GST</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    +{formatCurrency(stats?.gst_output ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Less ITC</span>
                  <span className="text-sky-600 dark:text-sky-400">
                    -{formatCurrency(stats?.gst_input_credit ?? 0)}
                  </span>
                </div>

                {/* Per-type breakdown header */}
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div className="grid grid-cols-3 gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
                    <span></span>
                    <span className="text-right">Output</span>
                    <span className="text-right">ITC</span>
                  </div>
                  {hasIgst ? (
                    <GstRow
                      label="IGST"
                      output={stats?.gst_output_igst ?? 0}
                      itc={stats?.gst_input_igst ?? 0}
                    />
                  ) : (
                    <>
                      <GstRow
                        label="CGST"
                        output={stats?.gst_output_cgst ?? 0}
                        itc={stats?.gst_input_cgst ?? 0}
                      />
                      <GstRow
                        label="SGST"
                        output={stats?.gst_output_sgst ?? 0}
                        itc={stats?.gst_input_sgst ?? 0}
                      />
                    </>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-500 dark:text-gray-400">Net Payable</span>
                    <span
                      className={
                        isPositive
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-sky-600 dark:text-sky-400"
                      }
                    >
                      {formatCurrency(payableTax)}
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
