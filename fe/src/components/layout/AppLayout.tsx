import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { authApi } from '@/api/auth';

export function AppLayout() {
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const { showSidebar } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - always rendered so mobile overlay works */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} sidebarVisible={showSidebar} />

      <div className={cn('flex flex-1 flex-col', showSidebar ? 'md:pl-64' : '')}>
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 pb-20 sm:pb-24">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
