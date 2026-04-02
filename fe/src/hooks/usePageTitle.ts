import { useEffect } from 'react';
import { create } from 'zustand';

interface PageTitleState {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  pageTitle: 'ERP',
  setPageTitle: (title) => set({ pageTitle: title }),
}));

export function usePageTitle(title: string) {
  const setPageTitle = usePageTitleStore((s) => s.setPageTitle);
  useEffect(() => {
    setPageTitle(title);
  }, [title, setPageTitle]);
}
