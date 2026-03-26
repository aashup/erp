import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/dashboard/Dashboard';
import Items from '@/pages/inventory/Items';
import Godowns from '@/pages/inventory/Godowns';
import Parties from '@/pages/Parties';
import Branches from '@/pages/Branches';
import PurchaseOrders from '@/pages/purchase/PurchaseOrders';
import PurchaseInvoices from '@/pages/purchase/PurchaseInvoices';
import SalesOrders from '@/pages/sales/SalesOrders';
import SalesInvoices from '@/pages/sales/SalesInvoices';
import ChartOfAccounts from '@/pages/accounting/ChartOfAccounts';
import JournalEntries from '@/pages/accounting/JournalEntries';
import Payments from '@/pages/accounting/Payments';
import Settings from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/login': 'Login',
  '/register': 'Register',
  '/inventory/items': 'Items',
  '/inventory/godowns': 'Godowns',
  '/parties': 'Parties',
  '/branches': 'Branches',
  '/purchase/orders': 'Purchase Orders',
  '/purchase/invoices': 'Purchase Invoices',
  '/sales/orders': 'Sales Orders',
  '/sales/invoices': 'Sales Invoices',
  '/accounting/accounts': 'Chart of Accounts',
  '/accounting/journals': 'Journal Entries',
  '/accounting/payments': 'Payments',
  '/settings': 'Settings',
};

function DocumentTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = PAGE_TITLES[location.pathname] ?? 'ERP';
    document.title = pageTitle === 'ERP' ? pageTitle : `${pageTitle} | ERP`;
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          error: {
            style: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
          },
          success: {
            style: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
          },
        }}
      />
      <BrowserRouter>
        <DocumentTitleManager />
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />

            {/* Inventory */}
            <Route path="/inventory/items" element={<Items />} />
            <Route path="/inventory/godowns" element={<Godowns />} />

            {/* Parties */}
            <Route path="/parties" element={<Parties />} />

            {/* Branches */}
            <Route path="/branches" element={<Branches />} />

            {/* Purchase */}
            <Route path="/purchase/orders" element={<PurchaseOrders />} />
            <Route path="/purchase/invoices" element={<PurchaseInvoices />} />

            {/* Sales */}
            <Route path="/sales/orders" element={<SalesOrders />} />
            <Route path="/sales/invoices" element={<SalesInvoices />} />

            {/* Accounting */}
            <Route path="/accounting/accounts" element={<ChartOfAccounts />} />
            <Route path="/accounting/journals" element={<JournalEntries />} />
            <Route path="/accounting/payments" element={<Payments />} />

            {/* Settings */}
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
