import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { useSync } from '@/hooks/useSync';
import { LogOut, User, Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingCount, doSync } = useSync();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h2 className="text-sm font-medium text-gray-500">
          {user?.company?.name ?? 'ERP'}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Sync Status Badge */}
        <button
          onClick={doSync}
          disabled={!isOnline || isSyncing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
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

        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
