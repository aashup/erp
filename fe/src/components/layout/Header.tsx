import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { useSync } from '@/hooks/useSync';
import { useTheme } from '@/contexts/ThemeContext';
import { LogOut, User, Wifi, WifiOff, RefreshCw, CloudOff, Sun, Moon, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingCount, doSync } = useSync();
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  const handleNavigateToSettings = () => {
    setShowDropdown(false);
    navigate('/settings');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {user?.company?.name ?? 'ERP'}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>

        {/* Sync Status Badge */}
        <button
          onClick={doSync}
          disabled={!isOnline || isSyncing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          title={isOnline ? 'Click to sync' : 'Offline'}
        >
          {!isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600">Offline</span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary-500" />
              <span className="text-primary-600">Syncing...</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <CloudOff className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-yellow-600">{pendingCount} pending</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600">Synced</span>
            </>
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user?.role}</p>
            </div>
            <svg
              className={`h-4 w-4 text-gray-500 transition-transform dark:text-gray-400 ${showDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 p-3 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Logged in as</p>
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <div>
                <button
                  onClick={handleNavigateToSettings}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4" />
                  My Profile & Settings
                </button>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
