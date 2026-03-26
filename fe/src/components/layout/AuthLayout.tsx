import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function AuthLayout() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
          title={resolvedTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {resolvedTheme === 'light' ? (
            <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Sun className="h-5 w-5 text-yellow-500" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white font-bold text-xl">
            E
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">ERP System</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">GST-Compliant Business Management</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
