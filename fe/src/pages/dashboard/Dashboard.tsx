import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuthStore } from "@/store/authStore";
import { itemsApi } from "@/api/inventory";
import { partiesApi } from "@/api/parties";
import { purchaseOrdersApi } from "@/api/purchase";
import { salesInvoicesApi } from "@/api/sales";
import { Package, ShoppingCart, IndianRupee, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TotalSalesWidget } from "./widgets/TotalSalesWidget";
import { NetRevenueWidget } from "./widgets/NetRevenueWidget";
import { TotalPurchaseWidget } from "./widgets/TotalPurchaseWidget";
import { ProfitLossWidget } from "./widgets/ProfitLossWidget";
import { PayableTaxWidget } from "./widgets/PayableTaxWidget";
import { SalesPurchaseChart } from "./widgets/SalesPurchaseChart";
import { LowStockAlerts } from "./widgets/LowStockAlerts";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { AlertsSyncWidget } from "./widgets/AlertsSyncWidget";
import { RecentInvoicesWidget } from "./widgets/RecentInvoicesWidget";

const COUNT_STATS: {
  name: string;
  color: string;
  Icon: LucideIcon;
  queryKey: string;
}[] = [
  { name: "Total Items", color: "bg-blue-500", Icon: Package, queryKey: "items" },
  { name: "Parties", color: "bg-green-500", Icon: Users, queryKey: "parties" },
  { name: "Purchase Orders", color: "bg-orange-500", Icon: ShoppingCart, queryKey: "purchase-orders" },
  { name: "Sales Invoices", color: "bg-purple-500", Icon: IndianRupee, queryKey: "sales-invoices" },
];

function CountStatCard({
  name,
  color,
  Icon,
  value,
}: {
  name: string;
  color: string;
  Icon: LucideIcon;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${color} text-white`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{name}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuthStore();

  const { data: itemsTotal } = useQuery({
    queryKey: ["items", 1],
    queryFn: () => itemsApi.list({ per_page: "1" }),
    select: (res) => res.data.total,
  });

  const { data: partiesTotal } = useQuery({
    queryKey: ["parties", 1],
    queryFn: () => partiesApi.list({ per_page: "1" }),
    select: (res) => res.data.total,
  });

  const { data: posTotal } = useQuery({
    queryKey: ["purchase-orders", 1],
    queryFn: () => purchaseOrdersApi.list({ per_page: "1" }),
    select: (res) => res.data.total,
  });

  const { data: invoicesTotal } = useQuery({
    queryKey: ["sales-invoices", 1],
    queryFn: () => salesInvoicesApi.list({ per_page: "1" }),
    select: (res) => res.data.total,
  });

  const countValues = [itemsTotal, partiesTotal, posTotal, invoicesTotal];

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
        {COUNT_STATS.map(({ name, color, Icon }, i) => (
          <CountStatCard
            key={name}
            name={name}
            color={color}
            Icon={Icon}
            value={countValues[i]?.toString() ?? "—"}
          />
        ))}
      </div>

      {/* Financial Widgets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <TotalSalesWidget />
        <NetRevenueWidget />
        <TotalPurchaseWidget />
        <ProfitLossWidget />
        <PayableTaxWidget />
      </div>

      {/* Sales / Purchase / Revenue Chart */}
      <SalesPurchaseChart />

      {/* Quick Actions + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActionsWidget />
        <AlertsSyncWidget />
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts />

      {/* Recent Sales Invoices */}
      <RecentInvoicesWidget />
    </div>
  );
}
