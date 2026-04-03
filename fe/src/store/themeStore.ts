import { create } from 'zustand';

export type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal' | 'indigo' | 'pink';
export type SurfaceColor = 'gray' | 'slate' | 'zinc' | 'neutral' | 'stone' | 'cream' | 'sky' | 'sage' | 'lavender';
export type ThemeAccentColorOptions = { value: AccentColor; label: string; color: string; ring: string }
export type ThemeSurfaceColorOptions = { value: SurfaceColor; label: string; swatch: string; ring: string }

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  accent: AccentColor;
  surface: SurfaceColor;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAccent: (accent: AccentColor) => void;
  setSurface: (surface: SurfaceColor) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
  accent: (localStorage.getItem('accent') as AccentColor) || 'blue',
  surface: (localStorage.getItem('surface') as SurfaceColor) || 'gray',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setAccent: (accent) => {
    localStorage.setItem('accent', accent);
    set({ accent });
  },
  setSurface: (surface) => {
    localStorage.setItem('surface', surface);
    set({ surface });
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
