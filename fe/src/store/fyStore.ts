import { create } from 'zustand';
import type { FinancialYear } from '@/types';

interface FYState {
  selectedFY: FinancialYear | null;
  allFYs: FinancialYear[];
  setSelectedFY: (fy: FinancialYear) => void;
  setAllFYs: (fys: FinancialYear[]) => void;
  clearFY: () => void;
}

export const useFYStore = create<FYState>((set) => {
  const stored = localStorage.getItem('selectedFY');

  return {
    selectedFY: stored ? JSON.parse(stored) : null,
    allFYs: [],

    setSelectedFY: (fy) => {
      localStorage.setItem('selectedFY', JSON.stringify(fy));
      set({ selectedFY: fy });
    },

    setAllFYs: (fys) => set({ allFYs: fys }),

    clearFY: () => {
      localStorage.removeItem('selectedFY');
      set({ selectedFY: null, allFYs: [] });
    },
  };
});
