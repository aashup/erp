import { useQuery } from '@tanstack/react-query';
import type { EntityTable } from 'dexie';
import type { PaginatedResponse } from '@/types';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthStore } from '@/store/authStore';

/**
 * Wraps useQuery with an offline fallback that reads from Dexie.
 * When online: calls the API and caches results into Dexie (sync_status: 'synced').
 * When offline: reads all company records from Dexie and returns a fake paginated wrapper.
 */
export function useOfflineListQuery<T extends { id: string; company_id: string }>(config: {
  table: EntityTable<T, 'id'>;
  queryKey: unknown[];
  apiFn: () => Promise<{ data: PaginatedResponse<T> }>;
  offlineFilter?: (items: T[]) => T[];
  enabled?: boolean;
}) {
  const isOnline = useOnlineStatus();
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: [...config.queryKey, isOnline ? 'online' : 'offline'],
    enabled: config.enabled,
    queryFn: async (): Promise<PaginatedResponse<T>> => {
      if (!isOnline) {
        let items = await config.table
          .where('company_id').equals(user!.company_id)
          .toArray();
        if (config.offlineFilter) {
          items = config.offlineFilter(items);
        }
        return {
          data: items,
          current_page: 1,
          last_page: 1,
          total: items.length,
          per_page: items.length,
        };
      }
      const res = await config.apiFn();
      const pageData = res.data;
      for (const item of pageData.data) {
        await config.table.put({ ...item, sync_status: 'synced' } as T);
      }
      return pageData;
    },
  });
}
