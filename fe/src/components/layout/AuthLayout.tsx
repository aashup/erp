import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white font-bold text-xl">
            E
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">ERP System</h1>
          <p className="mt-1 text-sm text-gray-500">GST-Compliant Business Management</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
