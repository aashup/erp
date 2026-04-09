import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/store/authStore";
import { useSync } from "@/hooks/useSync";
import { itemsApi, stockLedgerApi } from "@/api/inventory";
import { partiesApi } from "@/api/parties";
import { purchaseOrdersApi } from "@/api/purchase";
import { salesInvoicesApi } from "@/api/sales";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  IndianRupee,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  RefreshCw,
  Receipt,
  Landmark,
} from "lucide-react";
import { Link } from "react-router-dom";
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

const chartTypeOptions: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "stacked", label: "Stacked" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
];

type Period = "today" | "this_week" | "this_month" | "this_year";

const periodLabels: Record<Period, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  this_year: "This Year",
};

function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(periodLabels) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );
}

function LowStockAlerts() {
  const { data: alerts } = useQuery({
    queryKey: ["reorder-alerts"],
    queryFn: () => stockLedgerApi.reorderAlerts(),
    select: (res) => res.data.data,
  });

  if (!alerts || alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Low Stock Alerts
            </h3>
          </div>
          <Link
            to="/inventory/stock-summary"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts
            .slice(0, 5)
            .map(
              (alert: {
                item_id: string;
                item_name: string;
                current_stock: number;
                reorder_level: number;
              }) => (
                <div
                  key={alert.item_id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {alert.item_name}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      Stock: {alert.current_stock}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Reorder: {alert.reorder_level}
                    </span>
                  </div>
                </div>
              ),
            )}
          {alerts.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
              +{alerts.length - 5} more items below reorder level
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SalesPurchaseChart() {
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

  const colors = {
    sales: { bg: "rgba(34,197,94,", border: "rgb(34,197,94)" },
    purchase: { bg: "rgba(249,115,22,", border: "rgb(249,115,22)" },
    revenue: { bg: "rgba(59,130,246,", border: "rgb(59,130,246)" },
  };

  const makeDataset = (
    label: string,
    values: number[],
    color: typeof colors.sales,
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
      makeDataset("Sales", chartData?.sales ?? [], colors.sales),
      makeDataset("Purchase", chartData?.purchase ?? [], colors.purchase),
      makeDataset("Revenue", chartData?.revenue ?? [], colors.revenue),
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
          label: (ctx: {
            dataset: { label?: string };
            parsed: { y: number };
          }) =>
            `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN")}`,
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
            `₹${Number(value).toLocaleString("en-IN", { notation: "compact", compactDisplay: "short" } as Intl.NumberFormatOptions)}`,
        },
      },
    },
  };

  const monthOptions = [
    { value: 6, label: "6 Months" },
    { value: 12, label: "12 Months" },
  ];

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
              {chartTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {monthOptions.map((opt) => (
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

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuthStore();
  const { pendingCount, lastSync, isSyncing } = useSync();
  const [salesPeriod, setSalesPeriod] = useState<Period>("this_month");
  const [purchasePeriod, setPurchasePeriod] = useState<Period>("this_month");
  const [pnlPeriod, setPnlPeriod] = useState<Period>("this_month");
  const [netRevenuePeriod, setNetRevenuePeriod] =
    useState<Period>("this_month");
  const [taxPeriod, setTaxPeriod] = useState<Period>("this_month");

  const { data: itemsData } = useQuery({
    queryKey: ["items", 1],
    queryFn: () => itemsApi.list({ per_page: "1" }),
    select: (res) => res.data,
  });

  const { data: partiesData } = useQuery({
    queryKey: ["parties", 1],
    queryFn: () => partiesApi.list({ per_page: "1" }),
    select: (res) => res.data,
  });

  const { data: posData } = useQuery({
    queryKey: ["purchase-orders", 1],
    queryFn: () => purchaseOrdersApi.list({ per_page: "1" }),
    select: (res) => res.data,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["sales-invoices", 1],
    queryFn: () => salesInvoicesApi.list({ per_page: "5" }),
    select: (res) => res.data,
  });

  // Dashboard stats queries — each widget has its own period
  const { data: salesStats, isLoading: salesLoading } = useQuery({
    queryKey: ["dashboard-stats-sales", salesPeriod],
    queryFn: () => dashboardApi.stats(salesPeriod),
    select: (res) => res.data.data,
  });

  const { data: purchaseStats, isLoading: purchaseLoading } = useQuery({
    queryKey: ["dashboard-stats-purchase", purchasePeriod],
    queryFn: () => dashboardApi.stats(purchasePeriod),
    select: (res) => res.data.data,
  });

  const { data: pnlStats, isLoading: pnlLoading } = useQuery({
    queryKey: ["dashboard-stats-pnl", pnlPeriod],
    queryFn: () => dashboardApi.stats(pnlPeriod),
    select: (res) => res.data.data,
  });

  const { data: netRevenueStats, isLoading: netRevenueLoading } = useQuery({
    queryKey: ["dashboard-stats-net-revenue", netRevenuePeriod],
    queryFn: () => dashboardApi.stats(netRevenuePeriod),
    select: (res) => res.data.data,
  });

  const { data: taxStats, isLoading: taxLoading } = useQuery({
    queryKey: ["dashboard-stats-tax", taxPeriod],
    queryFn: () => dashboardApi.stats(taxPeriod),
    select: (res) => res.data.data,
  });

  const countStats = [
    {
      name: "Total Items",
      value: itemsData?.total?.toString() ?? "—",
      icon: Package,
      color: "bg-blue-500",
    },
    {
      name: "Parties",
      value: partiesData?.total?.toString() ?? "—",
      icon: Users,
      color: "bg-green-500",
    },
    {
      name: "Purchase Orders",
      value: posData?.total?.toString() ?? "—",
      icon: ShoppingCart,
      color: "bg-orange-500",
    },
    {
      name: "Sales Invoices",
      value: invoicesData?.total?.toString() ?? "—",
      icon: IndianRupee,
      color: "bg-purple-500",
    },
  ];

  const quickActions = [
    { name: "New Sales Invoice", href: "/sales/invoices", icon: TrendingUp },
    {
      name: "New Purchase Order",
      href: "/purchase/orders",
      icon: TrendingDown,
    },
    { name: "Add Item", href: "/inventory/items", icon: Package },
    { name: "Add Party", href: "/parties", icon: Users },
  ];

  const recentInvoices = invoicesData?.data ?? [];
  const pnlValue = pnlStats?.pnl ?? 0;
  const pnlIsPositive = pnlValue >= 0;
  const payableTaxValue = taxStats?.payable_tax ?? 0;
  const payableTaxPositive = payableTaxValue >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome, {user?.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Count Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {countStats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="flex items-center gap-4 py-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color} text-white`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales / Purchase / P&L Widgets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {/* Total Sales */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total Sales
                </h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={salesPeriod} onChange={setSalesPeriod} />
            <div className="mt-4">
              {salesLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(salesStats?.total_sales ?? 0)}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {salesStats?.from} — {salesStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Revenue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <Receipt className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Net Revenue
                </h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter
              value={netRevenuePeriod}
              onChange={setNetRevenuePeriod}
            />
            <div className="mt-4">
              {netRevenueLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(netRevenueStats?.net_revenue ?? 0)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Actual earnings after removing GST from sales
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Sales {formatCurrency(netRevenueStats?.total_sales ?? 0)} -
                    GST {formatCurrency(netRevenueStats?.gst_output ?? 0)}
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {netRevenueStats?.from} — {netRevenueStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Purchase */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total Purchase
                </h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={purchasePeriod} onChange={setPurchasePeriod} />
            <div className="mt-4">
              {purchaseLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(purchaseStats?.total_purchase ?? 0)}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {purchaseStats?.from} — {purchaseStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* P&L */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${pnlIsPositive ? "bg-emerald-500" : "bg-red-500"} text-white`}
                >
                  <IndianRupee className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Profit & Loss
                </h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={pnlPeriod} onChange={setPnlPeriod} />
            <div className="mt-4">
              {pnlLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <>
                  <p
                    className={`text-3xl font-bold ${pnlIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(pnlValue)}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Sales: {formatCurrency(pnlStats?.total_sales ?? 0)}
                    </span>
                    <span>
                      Purchase: {formatCurrency(pnlStats?.total_purchase ?? 0)}
                    </span>
                  </div>
                </>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {pnlStats?.from} — {pnlStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payable Tax */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${payableTaxPositive ? "bg-amber-500" : "bg-sky-500"} text-white`}
                >
                  <Landmark className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Payable Tax
                </h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={taxPeriod} onChange={setTaxPeriod} />
            <div className="mt-4">
              {taxLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <>
                  <p
                    className={`text-3xl font-bold ${payableTaxPositive ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`}
                  >
                    {formatCurrency(payableTaxValue)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    GST collected minus input tax credit
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Output {formatCurrency(taxStats?.gst_output ?? 0)} - ITC{" "}
                    {formatCurrency(taxStats?.gst_input_credit ?? 0)}
                  </p>
                  {!payableTaxPositive && (
                    <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                      Input credit exceeds output GST
                    </p>
                  )}
                </>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {taxStats?.from} — {taxStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales / Purchase / Revenue Chart */}
      <SalesPurchaseChart />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Quick Actions
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  to={action.href}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <action.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action.name}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Sync */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Alerts & Sync
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCount > 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 p-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    {pendingCount} record(s) pending sync
                  </span>
                </div>
              )}
              {isSyncing && (
                <div className="flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Syncing data...
                  </span>
                </div>
              )}
              {!isSyncing && pendingCount === 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
                  <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    All data synced
                    {lastSync
                      ? ` — last sync ${lastSync.toLocaleTimeString("en-IN")}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts />

      {/* Recent Sales Invoices */}
      {recentInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Recent Sales Invoices
              </h3>
              <Link
                to="/sales/invoices"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2 font-medium">Invoice #</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium text-right">Balance</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-0 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                    >
                      <td className="py-2 font-medium">{inv.invoice_number}</td>
                      <td className="py-2">{inv.party?.name ?? "—"}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(inv.balance_due)}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={
                            inv.status === "confirmed"
                              ? "success"
                              : inv.status === "cancelled"
                                ? "danger"
                                : "default"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
