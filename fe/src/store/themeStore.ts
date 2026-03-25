import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      let newTheme: 'light' | 'dark' | 'system';
      if (state.theme === 'light') {
        newTheme = 'dark';
      } else if (state.theme === 'dark') {
        newTheme = 'system';
      } else {
        newTheme = 'light';
      }
      localStorage.setItem('theme', newTheme);
      return { theme: newTheme };
    }),
}));
