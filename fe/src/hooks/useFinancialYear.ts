import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { financialYearsApi } from "@/api/financialYears";
import { useFYStore } from "@/store/fyStore";
import { useAuthStore } from "@/store/authStore";
import { fyDateBounds } from "@/lib/utils";

/**
 * Hook that loads financial years and auto-selects the current one.
 * Call this once in AppLayout so FY is always available.
 */
export function useFinancialYear() {
  const { isAuthenticated } = useAuthStore();
  const { selectedFY, setSelectedFY, setAllFYs } = useFYStore();

  const { data } = useQuery({
    queryKey: ["financial-years"],
    queryFn: () => financialYearsApi.list({ per_page: "50" }),
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

/**
 * Returns the IST-adjusted date bounds for the selected FY, plus its label.
 * FY dates are stored 1 day earlier (IST→UTC), so +1 day is applied to both.
 * Returns undefined when no FY is selected.
 */
export function useFYBounds():
  | { start: string; end: string; label: string }
  | undefined {
  const selectedFY = useFYStore((s) => s.selectedFY);
  return useMemo(() => {
    if (!selectedFY) return undefined;
    const bounds = fyDateBounds(selectedFY);
    return { ...bounds, label: selectedFY.label };
  }, [
    selectedFY?.id,
    selectedFY?.start_date,
    selectedFY?.end_date,
    selectedFY?.label,
  ]);
}
