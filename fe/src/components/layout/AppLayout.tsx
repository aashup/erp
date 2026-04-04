import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const { showSidebar } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize FY loading & auto-select
  useFinancialYear();

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
