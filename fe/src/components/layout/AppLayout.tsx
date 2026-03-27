import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';

export function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize FY loading & auto-select
  useFinancialYear();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Sidebar Overlay */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="md:pl-64">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
