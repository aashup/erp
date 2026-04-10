import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useSync } from "@/hooks/useSync";

export function AlertsSyncWidget() {
  const { pendingCount, lastSync, isSyncing } = useSync();

  return (
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
  );
}
