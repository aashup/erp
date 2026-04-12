import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { dashboardApi } from "@/api/dashboard";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

type ChartType = "bar" | "stacked" | "line" | "area";

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "stacked", label: "Stacked" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
];

const MONTH_OPTIONS = [
  { value: 6, label: "6 Months" },
  { value: 12, label: "12 Months" },
];

const COLORS = {
  sales: { bg: "rgba(34,197,94,", border: "rgb(34,197,94)" },
  purchase: { bg: "rgba(249,115,22,", border: "rgb(249,115,22)" },
  revenue: { bg: "rgba(59,130,246,", border: "rgb(59,130,246)" },
};

export function SalesPurchaseChart() {
  const [months, setMonths] = useState(12);
  const [chartType, setChartType] = useState<ChartType>("area");

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dashboard-chart", months],
    queryFn: () => dashboardApi.chart(months),
    select: (res) => res.data.data,
  });

  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#9ca3af" : "#6b7280";

  const isLine = chartType === "line" || chartType === "area";
  const isStacked = chartType === "stacked";
  const isArea = chartType === "area";

  const makeDataset = (
    label: string,
    values: number[],
    color: (typeof COLORS)[keyof typeof COLORS],
  ) => ({
    label,
    data: values,
    ...(isLine
      ? {
          borderColor: color.border,
          backgroundColor: isArea ? color.bg + "0.2)" : color.bg + "0.8)",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: isArea,
        }
      : {
          backgroundColor: isDark ? color.bg + "0.7)" : color.bg + "0.8)",
          borderRadius: isStacked ? 0 : 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        }),
  });

  const data = {
    labels: chartData?.labels ?? [],
    datasets: [
      makeDataset("Sales", chartData?.sales ?? [], COLORS.sales),
      makeDataset("Purchase", chartData?.purchase ?? [], COLORS.purchase),
      makeDataset("Revenue", chartData?.revenue ?? [], COLORS.revenue),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: textColor,
          usePointStyle: true,
          pointStyle: isLine ? "circle" : "rectRounded",
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ₹${(ctx.parsed.y ?? 0).toLocaleString("en-IN")}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor },
        stacked: isStacked,
      },
      y: {
        grid: { color: gridColor },
        stacked: isStacked,
        ticks: {
          color: textColor,
          callback: (value: string | number) =>
            `₹${Number(value).toLocaleString("en-IN", {
              notation: "compact",
              compactDisplay: "short",
            } as Intl.NumberFormatOptions)}`,
        },
      },
    },
  };

  const ChartComponent = isLine ? Line : Bar;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Sales vs Purchase vs Revenue
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {CHART_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {MONTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMonths(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    months === opt.value
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <div className="h-72">
            <ChartComponent data={data} options={options} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
