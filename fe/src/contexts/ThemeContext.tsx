import { createContext, useContext, useEffect, useState } from 'react';
import { useThemeStore, type AccentColor, type LightSurfaceColor, type DarkSurfaceColor, type FontFamily, type SurfaceColor } from '@/store/themeStore';

const accentPalettes: Record<Exclude<AccentColor, 'blue'>, Record<string, string>> = {
  emerald: {
    '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399',
    '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b',
  },
  violet: {
    '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa',
    '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95',
  },
  rose: {
    '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af', '400': '#fb7185',
    '500': '#f43f5e', '600': '#e11d48', '700': '#be123c', '800': '#9f1239', '900': '#881337',
  },
  amber: {
    '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24',
    '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f',
  },
  teal: {
    '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4', '400': '#2dd4bf',
    '500': '#14b8a6', '600': '#0d9488', '700': '#0f766e', '800': '#115e59', '900': '#134e4a',
  },
  indigo: {
    '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc', '400': '#818cf8',
    '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81',
  },
  pink: {
    '50': '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8', '300': '#f9a8d4', '400': '#f472b6',
    '500': '#ec4899', '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843',
  },
};

// Surface palettes override --color-gray-* to change backgrounds, borders, text
const surfacePalettes: Record<Exclude<SurfaceColor, 'gray'>, Record<string, string>> = {
  slate: {
    '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8',
    '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a',
    '950': '#020617',
  },
  zinc: {
    '50': '#fafafa', '100': '#f4f4f5', '200': '#e4e4e7', '300': '#d4d4d8', '400': '#a1a1aa',
    '500': '#71717a', '600': '#52525b', '700': '#3f3f46', '800': '#27272a', '900': '#18181b',
    '950': '#09090b',
  },
  neutral: {
    '50': '#fafafa', '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a3a3a3',
    '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717',
    '950': '#0a0a0a',
  },
  stone: {
    '50': '#fafaf9', '100': '#f5f5f4', '200': '#e7e5e4', '300': '#d6d3d1', '400': '#a8a29e',
    '500': '#78716c', '600': '#57534e', '700': '#44403c', '800': '#292524', '900': '#1c1917',
    '950': '#0c0a09',
  },
  // Tinted surfaces — noticeable color in light mode
  cream: {
    '50': '#fefcf6', '100': '#fdf8ec', '200': '#f5edda', '300': '#e8ddc4', '400': '#bfae8e',
    '500': '#8f7e62', '600': '#6b5d47', '700': '#544838', '800': '#3a3228', '900': '#26211b',
    '950': '#141110',
  },
  sky: {
    '50': '#f2f8fc', '100': '#e8f2fa', '200': '#d4e4f0', '300': '#b4cedf', '400': '#82a8c3',
    '500': '#5e869f', '600': '#466981', '700': '#365268', '800': '#253a4c', '900': '#192836',
    '950': '#0c151e',
  },
  sage: {
    '50': '#f4f8f4', '100': '#ebf2eb', '200': '#d6e4d6', '300': '#b8cfb8', '400': '#88ad88',
    '500': '#618a61', '600': '#496c49', '700': '#3a553a', '800': '#2a3d2a', '900': '#1c2a1c',
    '950': '#0e160e',
  },
  lavender: {
    '50': '#f6f4fc', '100': '#efecfa', '200': '#dfd9f2', '300': '#c8bee6', '400': '#a593cf',
    '500': '#7f6cad', '600': '#615189', '700': '#4c3f6d', '800': '#372e50', '900': '#252038',
    '950': '#13111e',
  },
};

const fontPalettes: Record<FontFamily, string> = {
  sans: 'system-ui, -apple-system, sans-serif',
  serif: 'Georgia, serif',
  monospace: "'Courier New', monospace",
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  poppins: '"Poppins", sans-serif',
  openSans: '"Open Sans", sans-serif',
  merriweather: '"Merriweather", serif',
};

const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const grayShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

type ThemeContextType = {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  accent: AccentColor;
  surfaceLight: LightSurfaceColor;
  surfaceDark: DarkSurfaceColor;
  fontFamily: FontFamily;
  fontSizeScale: number;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAccent: (accent: AccentColor) => void;
  setSurfaceLight: (surface: LightSurfaceColor) => void;
  setSurfaceDark: (surface: DarkSurfaceColor) => void;
  setFontFamily: (font: FontFamily) => void;
  setFontSizeScale: (scale: number) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, accent, surfaceLight, surfaceDark, fontFamily, fontSizeScale, toggleTheme, setTheme, setAccent, setSurfaceLight, setSurfaceDark, setFontFamily, setFontSizeScale } = useThemeStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Apply accent color overrides
  useEffect(() => {
    const root = document.documentElement;
    if (accent === 'blue') {
      for (const s of shades) root.style.removeProperty(`--color-primary-${s}`);
    } else {
      const palette = accentPalettes[accent];
      for (const [shade, color] of Object.entries(palette)) {
        root.style.setProperty(`--color-primary-${shade}`, color);
      }
    }
  }, [accent]);

  // Apply surface/background color overrides based on resolved theme
  useEffect(() => {
    const root = document.documentElement;
    const activeSurface = resolvedTheme === 'dark' ? surfaceDark : surfaceLight;
    if (activeSurface === 'gray') {
      for (const s of grayShades) root.style.removeProperty(`--color-gray-${s}`);
    } else {
      const palette = surfacePalettes[activeSurface as Exclude<typeof activeSurface, 'gray'>];
      for (const [shade, color] of Object.entries(palette)) {
        root.style.setProperty(`--color-gray-${shade}`, color);
      }
    }
  }, [surfaceLight, surfaceDark, resolvedTheme]);

  // Apply font family
  useEffect(() => {
    const root = document.documentElement;
    const font = fontPalettes[fontFamily];
    root.style.setProperty('--font-family', font);
  }, [fontFamily]);

  // Apply font size scale
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-size-scale', String(fontSizeScale / 100));
  }, [fontSizeScale]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accent, surfaceLight, surfaceDark, fontFamily, fontSizeScale, toggleTheme, setTheme, setAccent, setSurfaceLight, setSurfaceDark, setFontFamily, setFontSizeScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
