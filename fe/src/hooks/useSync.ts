import { useEffect, useCallback, useState, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { syncAll, getPendingCount } from '@/lib/sync';
import { useAuthStore } from '@/store/authStore';

export function useSync() {
  const isOnline = useOnlineStatus();
  const { isAuthenticated } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Ref-based guard so doSync doesn't need isSyncing in its deps
  // (avoids the re-render loop: isSyncing → new doSync → effects re-fire → doSync called again)
  const isSyncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const doSync = useCallback(async () => {
    if (!isAuthenticated || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncAll();
      setLastSync(new Date());
      await refreshPendingCount();
    } catch {
      // Sync failed — will retry next time
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isAuthenticated, refreshPendingCount]); // no isSyncing dep → stable reference

  // Auto-sync once when coming back online
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      doSync();
    }
  }, [isOnline, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic sync every 5 minutes
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return;

    const interval = setInterval(doSync, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, [isOnline, isAuthenticated, doSync]);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return { isOnline, isSyncing, pendingCount, lastSync, doSync, refreshPendingCount };
}
