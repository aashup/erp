import { create } from 'zustand';

interface DateState {
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  resetToToday: () => void;
}

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const useDateStore = create<DateState>((set) => {
  const stored = localStorage.getItem('selectedDate');
  return {
    selectedDate: stored ?? todayStr(),
    setSelectedDate: (date) => {
      localStorage.setItem('selectedDate', date);
      set({ selectedDate: date });
    },
    resetToToday: () => {
      const today = todayStr();
      localStorage.setItem('selectedDate', today);
      set({ selectedDate: today });
    },
  };
});
