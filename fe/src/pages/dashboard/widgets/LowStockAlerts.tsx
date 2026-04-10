import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { stockLedgerApi } from "@/api/inventory";

interface ReorderAlert {
  item_id: string;
  item_name: string;
  current_stock: number;
  reorder_level: number;
}

export function LowStockAlerts() {
  const { data: alerts } = useQuery({
    queryKey: ["reorder-alerts"],
    queryFn: () => stockLedgerApi.reorderAlerts(),
    select: (res) => res.data.data as ReorderAlert[],
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
          {alerts.slice(0, 5).map((alert) => (
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
          ))}
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
