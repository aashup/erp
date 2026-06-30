import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/store/authStore";
import { useSync } from "@/hooks/useSync";
import { itemsApi } from "@/api/inventory";
import { partiesApi } from "@/api/parties";
import { purchaseOrdersApi } from "@/api/purchase";
import { salesInvoicesApi } from "@/api/sales";
import { useFYStore } from "@/store/fyStore";

import { CountStatsRow } from "./widgets/CountStatsRow";
import { TotalSalesWidget } from "./widgets/TotalSalesWidget";
import { NetRevenueWidget } from "./widgets/NetRevenueWidget";
import { TotalPurchaseWidget } from "./widgets/TotalPurchaseWidget";
import { ProfitLossWidget } from "./widgets/ProfitLossWidget";
import { PayableTaxWidget } from "./widgets/PayableTaxWidget";
import { CollectionWidget } from "./widgets/CollectionWidget";
import { SalesPurchaseChart } from "./widgets/SalesPurchaseChart";
import { QuickActions } from "./widgets/QuickActions";
import { AlertsSync } from "./widgets/AlertsSync";
import { LowStockAlerts } from "./widgets/LowStockAlerts";
import { RecentInvoices } from "./widgets/RecentInvoices";

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuthStore();
  const { pendingCount, lastSync, isSyncing } = useSync();
  const selectedFY = useFYStore((s) => s.selectedFY);

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
    queryKey: ["purchase-orders", 1, selectedFY?.id],
    queryFn: () => purchaseOrdersApi.list({ per_page: "1" }),
    select: (res) => res.data,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["sales-invoices", 1, selectedFY?.id],
    queryFn: () => salesInvoicesApi.list({ per_page: "5" }),
    select: (res) => res.data,
  });

  const recentInvoices = invoicesData?.data ?? [];

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
      <CountStatsRow
        itemsTotal={itemsData?.total}
        partiesTotal={partiesData?.total}
        posTotal={posData?.total}
        invoicesTotal={invoicesData?.total}
      />

      {/* Financial Widgets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <TotalSalesWidget />
        <NetRevenueWidget />
        <TotalPurchaseWidget />
        <ProfitLossWidget />
        <PayableTaxWidget />
        <CollectionWidget />
      </div>

      {/* Sales / Purchase / Revenue Chart */}
      <SalesPurchaseChart />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActions />
        <AlertsSync
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          lastSync={lastSync}
        />
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts />

      {/* Recent Sales Invoices */}
      <RecentInvoices invoices={recentInvoices} />
    </div>
  );
}
