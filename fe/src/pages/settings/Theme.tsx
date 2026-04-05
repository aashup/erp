import { Check, Menu, Monitor, Palette, Sun, Moon } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeStore } from "@/store/themeStore";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type {
  ThemeAccentColorOptions,
  ThemeSurfaceColorOptions,
} from "@/store/themeStore";

const accentOptions: ThemeAccentColorOptions[] = [
  { value: "blue", label: "Blue", color: "bg-blue-500", ring: "ring-blue-500" },
  {
    value: "indigo",
    label: "Indigo",
    color: "bg-indigo-500",
    ring: "ring-indigo-500",
  },
  {
    value: "violet",
    label: "Violet",
    color: "bg-violet-500",
    ring: "ring-violet-500",
  },
  { value: "pink", label: "Pink", color: "bg-pink-500", ring: "ring-pink-500" },
  { value: "rose", label: "Rose", color: "bg-rose-500", ring: "ring-rose-500" },
  {
    value: "amber",
    label: "Amber",
    color: "bg-amber-500",
    ring: "ring-amber-500",
  },
  {
    value: "emerald",
    label: "Emerald",
    color: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  { value: "teal", label: "Teal", color: "bg-teal-500", ring: "ring-teal-500" },
];

const surfaceOptions: {
  light: ThemeSurfaceColorOptions[];
  dark: ThemeSurfaceColorOptions[];
} = {
  light: [
    {
      value: "gray",
      label: "Default",
      swatch: "bg-gray-300",
      ring: "ring-gray-400",
    },
    {
      value: "cream",
      label: "Cream",
      swatch: "bg-amber-200",
      ring: "ring-amber-300",
    },
    { value: "sky", label: "Sky", swatch: "bg-sky-300", ring: "ring-sky-400" },
    {
      value: "sage",
      label: "Sage",
      swatch: "bg-green-300",
      ring: "ring-green-400",
    },
    {
      value: "lavender",
      label: "Lavender",
      swatch: "bg-purple-300",
      ring: "ring-purple-400",
    },
  ],
  dark: [
    {
      value: "gray",
      label: "Gray",
      swatch: "bg-gray-500",
      ring: "ring-gray-500",
    },
    {
      value: "slate",
      label: "Slate",
      swatch: "bg-slate-500",
      ring: "ring-slate-500",
    },
    {
      value: "zinc",
      label: "Zinc",
      swatch: "bg-zinc-500",
      ring: "ring-zinc-500",
    },
    {
      value: "neutral",
      label: "Neutral",
      swatch: "bg-neutral-500",
      ring: "ring-neutral-500",
    },
    {
      value: "stone",
      label: "Stone",
      swatch: "bg-stone-500",
      ring: "ring-stone-500",
    },
  ],
};

export default function Theme() {
  usePageTitle("Theme");
  const { theme, accent, surfaceLight, surfaceDark, setTheme, setAccent, setSurfaceLight, setSurfaceDark } =
    useTheme();
  const { showSidebar, setSidebarVisibility } = useThemeStore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Theme
      </h1>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Appearance</h3>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Choose how the app looks for you
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                theme === "light"
                  ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <Sun className="h-6 w-6 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Light
              </span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                theme === "dark"
                  ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <Moon className="h-6 w-6 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Dark
              </span>
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                theme === "system"
                  ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065 1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065 1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.065-2.572c-1.543-.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                System
              </span>
            </button>
          </div>
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Secondary Color
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {accentOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAccent(opt.value)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${opt.color} ${
                      accent === opt.value
                        ? `ring-2 ring-offset-2 ${opt.ring} dark:ring-offset-gray-800`
                        : ""
                    } transition-all`}
                  >
                    {accent === opt.value && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Dark Theme Background
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {surfaceOptions.dark.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSurfaceDark(opt.value as any)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${opt.swatch} ${
                      surfaceDark === opt.value
                        ? `ring-2 ring-offset-2 ${opt.ring} dark:ring-offset-gray-800`
                        : ""
                    } transition-all`}
                  >
                    {surfaceDark === opt.value && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Light Theme Background
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {surfaceOptions.light.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSurfaceLight(opt.value as any)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${opt.swatch} ${
                      surfaceLight === opt.value
                        ? `ring-2 ring-offset-2 ${opt.ring} dark:ring-offset-gray-800`
                        : ""
                    } transition-all`}
                  >
                    {surfaceLight === opt.value && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="flex items-center gap-3">
              <Menu className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSidebar}
                  onChange={(e) => setSidebarVisibility(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show sidebar by default
                </span>
              </label>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Theme saved automatically
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
