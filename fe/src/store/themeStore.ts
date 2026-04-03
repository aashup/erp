import { create } from 'zustand';

export type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal' | 'indigo' | 'pink';
export type DarkSurfaceColor = 'gray' | 'slate' | 'zinc' | 'neutral' | 'stone';
export type LightSurfaceColor = 'gray' | 'cream' | 'sky' | 'sage' | 'lavender';
export type SurfaceColor = DarkSurfaceColor | LightSurfaceColor;
export type ThemeAccentColorOptions = { value: AccentColor; label: string; color: string; ring: string }
export type ThemeSurfaceColorOptions = { value: SurfaceColor; label: string; swatch: string; ring: string }

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  accent: AccentColor;
  surfaceLight: LightSurfaceColor;
  surfaceDark: DarkSurfaceColor;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAccent: (accent: AccentColor) => void;
  setSurfaceLight: (surface: LightSurfaceColor) => void;
  setSurfaceDark: (surface: DarkSurfaceColor) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
  accent: (localStorage.getItem('accent') as AccentColor) || 'blue',
  surfaceLight: (localStorage.getItem('surfaceLight') as LightSurfaceColor) || 'gray',
  surfaceDark: (localStorage.getItem('surfaceDark') as DarkSurfaceColor) || 'gray',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setAccent: (accent) => {
    localStorage.setItem('accent', accent);
    set({ accent });
  },
  setSurfaceLight: (surface) => {
    localStorage.setItem('surfaceLight', surface);
    set({ surfaceLight: surface });
  },
  setSurfaceDark: (surface) => {
    localStorage.setItem('surfaceDark', surface);
    set({ surfaceDark: surface });
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
