import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuthStore } from '@/store/authStore';
import { usePageTitleStore } from '@/hooks/usePageTitle';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/dashboard/Dashboard';
import ItemGroups from '@/pages/inventory/ItemGroups';
import Items from '@/pages/inventory/Items';
import Godowns from '@/pages/inventory/Godowns';
import StockSummary from '@/pages/inventory/StockSummary';
import StockLedger from '@/pages/inventory/StockLedger';
import StockTransfer from '@/pages/inventory/StockTransfer';
import StockAdjustment from '@/pages/inventory/StockAdjustment';
import OpeningStock from '@/pages/inventory/OpeningStock';
import ItemMovements from '@/pages/inventory/ItemMovements';
import Parties from '@/pages/Parties';
import Branches from '@/pages/Branches';
import PurchaseOrders from '@/pages/purchase/PurchaseOrders';
import PurchaseInvoices from '@/pages/purchase/PurchaseInvoices';
import PurchaseInvoiceFormPage from '@/pages/purchase/PurchaseInvoiceFormPage';
import SalesOrders from '@/pages/sales/SalesOrders';
import SalesInvoices from '@/pages/sales/SalesInvoices';
import SalesInvoiceFormPage from '@/pages/sales/SalesInvoiceFormPage';
import ChartOfAccounts from '@/pages/accounting/ChartOfAccounts';
import Ledgers from '@/pages/accounting/Ledgers';
import JournalEntries from '@/pages/accounting/JournalEntries';
import Payments from '@/pages/accounting/Payments';
import VouchersEntry from '@/pages/accounting/VouchersEntry';
import TrialBalance from '@/pages/accounting/TrialBalance';
import ProfitAndLoss from '@/pages/accounting/ProfitAndLoss';
import Settings from '@/pages/Settings';
import FinancialYears from '@/pages/settings/FinancialYears';
import Units from '@/pages/settings/Units';
import InventorySettings from '@/pages/settings/InventorySettings';
import InvoiceSettings from '@/pages/settings/InvoiceSettings';
import ThermalTemplateEditor from '@/pages/settings/ThermalTemplateEditor';
import Theme from '@/pages/settings/Theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function DocumentTitleManager() {
  const pageTitle = usePageTitleStore((s) => s.pageTitle);
  const companyName = useAuthStore((s) => s.user?.company?.name?.trim() || null);

  useEffect(() => {
    const appName = companyName || 'ERP';
    document.title = pageTitle === appName ? pageTitle : `${pageTitle} | ${appName}`;
  }, [companyName, pageTitle]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:!bg-gray-800 dark:!text-gray-200',
          error: {
            style: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
            className: 'dark:!bg-red-900/50 dark:!text-red-200 dark:!border-red-800',
          },
          success: {
            style: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
            className: 'dark:!bg-green-900/50 dark:!text-green-200 dark:!border-green-800',
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
            <Route path="/inventory/item-groups" element={<ItemGroups />} />
            <Route path="/inventory/items" element={<Items />} />
            <Route path="/inventory/godowns" element={<Godowns />} />
            <Route path="/inventory/stock-summary" element={<StockSummary />} />
            <Route path="/inventory/stock-ledger" element={<StockLedger />} />
            <Route path="/inventory/stock-transfer" element={<StockTransfer />} />
            <Route path="/inventory/stock-adjustment" element={<StockAdjustment />} />
            <Route path="/inventory/opening-stock" element={<OpeningStock />} />
            <Route path="/inventory/items/:itemId/movements" element={<ItemMovements />} />
            <Route path="/inventory/item-movements" element={<ItemMovements />} />

            {/* Parties */}
            <Route path="/parties" element={<Parties />} />

            {/* Branches */}
            <Route path="/branches" element={<Branches />} />

            {/* Purchase */}
            <Route path="/purchase/orders" element={<PurchaseOrders />} />
            <Route path="/purchase/invoices" element={<PurchaseInvoices />} />
            <Route path="/purchase/invoices/new" element={<PurchaseInvoiceFormPage />} />
            <Route path="/purchase/invoices/:invoiceId/edit" element={<PurchaseInvoiceFormPage />} />

            {/* Sales */}
            <Route path="/sales/orders" element={<SalesOrders />} />
            <Route path="/sales/invoices" element={<SalesInvoices />} />
            <Route path="/sales/invoices/new" element={<SalesInvoiceFormPage />} />
            <Route path="/sales/invoices/:invoiceId/edit" element={<SalesInvoiceFormPage />} />

            {/* Accounting */}
            <Route path="/accounting/accounts" element={<ChartOfAccounts />} />
            <Route path="/accounting/ledgers" element={<Ledgers />} />
            <Route path="/accounting/vouchers" element={<VouchersEntry />} />
            <Route path="/accounting/journals" element={<JournalEntries />} />
            <Route path="/accounting/payments" element={<Payments />} />
            <Route path="/accounting/trial-balance" element={<TrialBalance />} />
            <Route path="/accounting/profit-and-loss" element={<ProfitAndLoss />} />

            {/* Settings */}
            <Route path="/settings/base" element={<Settings />} />
            <Route path="/settings/theme" element={<Theme />} />
            <Route path="/settings/invoice" element={<InvoiceSettings />} />
            <Route path="/settings/thermal-templates" element={<ThermalTemplateEditor />} />
            <Route path="/settings/financial-years" element={<FinancialYears />} />
            <Route path="/settings/units" element={<Units />} />
            <Route path="/settings/inventory" element={<InventorySettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
