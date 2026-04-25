import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialYearsApi } from '@/api/financialYears';
import { useFYStore } from '@/store/fyStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Hook that loads financial years and auto-selects the current one.
 * Call this once in AppLayout so FY is always available.
 */
export function useFinancialYear() {
  const { isAuthenticated } = useAuthStore();
  const { selectedFY, setSelectedFY, setAllFYs } = useFYStore();

  const { data } = useQuery({
    queryKey: ['financial-years'],
    queryFn: () => financialYearsApi.list({ per_page: '50' }),
    enabled: isAuthenticated,
    select: (res) => res.data.data,
  });

  useEffect(() => {
    if (!data || data.length === 0) return;

    setAllFYs(data);

    // Read selectedFY as a snapshot (not reactive) to avoid re-run loops.
    // If the stored FY exists in fresh data → keep it (refresh stale fields).
    // Otherwise fall back to the current FY.
    const { selectedFY: stored } = useFYStore.getState();
    const match = stored ? data.find((fy) => fy.id === stored.id) : null;
    setSelectedFY(match ?? data.find((fy) => fy.is_current) ?? data[0]);
  }, [data, setAllFYs, setSelectedFY]);

  return { selectedFY, allFYs: data ?? [] };
}

/**
 * Returns the selected FY ID for passing to API calls.
 */
export function useSelectedFYId(): string | undefined {
  return useFYStore((s) => s.selectedFY?.id);
}
