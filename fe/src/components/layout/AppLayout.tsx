import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { authApi } from '@/api/auth';
import { usersApi } from '@/api/users';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function AppLayout() {
  const { isAuthenticated, user, updateUser, isImpersonating, endImpersonation } = useAuthStore();
  const { showSidebar } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Initialize FY loading & auto-select
  useFinancialYear();

  // Refresh permissions on app load — handles sessions created before permissions were introduced
  useEffect(() => {
    if (isAuthenticated && (!user?.permissions || user.permissions.length === 0)) {
      authApi.me().then((res) => {
        const data = res.data as { data: typeof user; permissions: string[] };
        if (data.permissions && user) {
          updateUser({ ...user, permissions: data.permissions });
        }
      }).catch(() => {
        // Silently fail — user stays logged in, menu falls back to no filtering
      });
    }
  }, [isAuthenticated]);

  const handleStopImpersonating = async () => {
    try {
      if (user?.id) await usersApi.revokeImpersonation(user.id).catch(() => {});
    } finally {
      endImpersonation();
      toast.success('Returned to your account');
      navigate('/users');
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
          <span>
            Impersonating <strong>{user?.name}</strong> ({user?.email}) — you are acting as this user
          </span>
          <button
            onClick={handleStopImpersonating}
            className="flex items-center gap-1.5 rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Sidebar - always rendered so mobile overlay works */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} sidebarVisible={showSidebar} />

      <div className={cn('flex flex-1 flex-col', showSidebar ? 'md:pl-64' : '')}>
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 pb-20 sm:pb-24">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
