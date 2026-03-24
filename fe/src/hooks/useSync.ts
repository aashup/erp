import { useEffect, useCallback, useState } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { syncAll, getPendingCount } from '@/lib/sync';
import { useAuthStore } from '@/store/authStore';

export function useSync() {
  const isOnline = useOnlineStatus();
  const { isAuthenticated } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const doSync = useCallback(async () => {
    if (!isAuthenticated || isSyncing) return;

    setIsSyncing(true);
    try {
      await syncAll();
      setLastSync(new Date());
      await refreshPendingCount();
    } catch {
      // Sync failed — will retry next time
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isSyncing, refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      doSync();
    }
  }, [isOnline, isAuthenticated, doSync]);

  // Periodic sync every 60 seconds
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return;

    const interval = setInterval(doSync, 60_000);
    return () => clearInterval(interval);
  }, [isOnline, isAuthenticated, doSync]);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return { isOnline, isSyncing, pendingCount, lastSync, doSync, refreshPendingCount };
}
