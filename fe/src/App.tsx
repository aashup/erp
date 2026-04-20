import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { useAuthStore } from "@/store/authStore";
import { usePageTitleStore } from "@/hooks/usePageTitle";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Dashboard from "@/pages/dashboard/Dashboard";
import ItemGroups from "@/pages/inventory/ItemGroups";
import Items from "@/pages/inventory/Items";
import Godowns from "@/pages/inventory/Godowns";
import StockSummary from "@/pages/inventory/StockSummary";
import StockLedger from "@/pages/inventory/StockLedger";
import StockTransfer from "@/pages/inventory/StockTransfer";
import StockAdjustment from "@/pages/inventory/StockAdjustment";
import OpeningStock from "@/pages/inventory/OpeningStock";
import ItemMovements from "@/pages/inventory/ItemMovements";
import ItemBatches from "@/pages/inventory/ItemBatches";
import ItemFormPage from "@/pages/inventory/ItemFormPage";
import AllBatches from "@/pages/inventory/AllBatches";
import Parties from "@/pages/Parties";
import Branches from "@/pages/Branches";
import Users from "@/pages/Users";
import Groups from "@/pages/Groups";
import PurchaseOrders from "@/pages/purchase/PurchaseOrders";
import PurchaseOrderFormPage from "@/pages/purchase/PurchaseOrderFormPage";
import PurchaseInvoices from "@/pages/purchase/PurchaseInvoices";
import PurchaseInvoiceFormPage from "@/pages/purchase/PurchaseInvoiceFormPage";
import OcrReviewPage from "@/pages/purchase/OcrReviewPage";
import SalesOrders from "@/pages/sales/SalesOrders";
import SalesOrderFormPage from "@/pages/sales/SalesOrderFormPage";
import SalesInvoices from "@/pages/sales/SalesInvoices";
import SalesInvoiceFormPage from "@/pages/sales/SalesInvoiceFormPage";
import SalesInvoiceFormPage2 from "@/pages/sales/SalesInvoiceFormPage2";
import ChartOfAccounts from "@/pages/accounting/ChartOfAccounts";
import Ledgers from "@/pages/accounting/Ledgers";
import Payments from "@/pages/accounting/Payments";
import VouchersHub from "@/pages/accounting/VouchersHub";
import VoucherTypeList from "@/pages/accounting/VoucherTypeList";
import VoucherEntryForm from "@/pages/accounting/VoucherEntryForm";
import TrialBalance from "@/pages/accounting/TrialBalance";
import ProfitAndLoss from "@/pages/accounting/ProfitAndLoss";
import BalanceSheet from "@/pages/accounting/BalanceSheet";
import CashBook from "@/pages/reports/CashBook";
import BankBook from "@/pages/reports/BankBook";
import LedgerBook from "@/pages/reports/LedgerBook";
import DayBook from "@/pages/reports/DayBook";
import Settings from "@/pages/Settings";
import FinancialYears from "@/pages/settings/FinancialYears";
import Units from "@/pages/settings/Units";
import InventorySettings from "@/pages/settings/InventorySettings";
import InvoiceSettings from "@/pages/settings/InvoiceSettings";
import ThermalTemplateEditor from "@/pages/settings/ThermalTemplateEditor";
import Theme from "@/pages/settings/Theme";
import POSPage from "@/pages/pos/POSPage";
import POSPage2 from "@/pages/pos2/POSPage2";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DocumentTitleManager() {
  const pageTitle = usePageTitleStore((s) => s.pageTitle);
  const companyName = useAuthStore(
    (s) => s.user?.company?.name?.trim() || null,
  );

  useEffect(() => {
    const appName = companyName || "ERP";
    document.title =
      pageTitle === appName ? pageTitle : `${pageTitle} | ${appName}`;
  }, [companyName, pageTitle]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          className: "dark:!bg-gray-800 dark:!text-gray-200",
          error: {
            style: {
              background: "#FEF2F2",
              color: "#991B1B",
              border: "1px solid #FECACA",
            },
            className:
              "dark:!bg-red-900/50 dark:!text-red-200 dark:!border-red-800",
          },
          success: {
            style: {
              background: "#F0FDF4",
              color: "#166534",
              border: "1px solid #BBF7D0",
            },
            className:
              "dark:!bg-green-900/50 dark:!text-green-200 dark:!border-green-800",
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
            <Route
              path="/inventory/stock-transfer"
              element={<StockTransfer />}
            />
            <Route
              path="/inventory/stock-adjustment"
              element={<StockAdjustment />}
            />
            <Route path="/inventory/opening-stock" element={<OpeningStock />} />
            <Route
              path="/inventory/items/:itemId/movements"
              element={<ItemMovements />}
            />
            <Route
              path="/inventory/item-movements"
              element={<ItemMovements />}
            />
            <Route path="/inventory/batches" element={<AllBatches />} />
            <Route path="/inventory/items/new" element={<ItemFormPage />} />
            <Route
              path="/inventory/items/:itemId/edit"
              element={<ItemFormPage />}
            />
            <Route
              path="/inventory/items/:itemId/batches"
              element={<ItemBatches />}
            />

            {/* Parties */}
            <Route path="/parties" element={<Parties />} />

            {/* Branches */}
            <Route path="/branches" element={<Branches />} />

            {/* Users & Groups */}
            <Route path="/users" element={<Users />} />
            <Route path="/groups" element={<Groups />} />

            {/* Purchase */}
            <Route path="/purchase/orders" element={<PurchaseOrders />} />
            <Route
              path="/purchase/orders/new"
              element={<PurchaseOrderFormPage />}
            />
            <Route
              path="/purchase/orders/:orderId/edit"
              element={<PurchaseOrderFormPage />}
            />
            <Route path="/purchase/invoices" element={<PurchaseInvoices />} />
            <Route
              path="/purchase/invoices/new"
              element={<PurchaseInvoiceFormPage />}
            />
            <Route
              path="/purchase/invoices/ocr-review"
              element={<OcrReviewPage />}
            />
            <Route
              path="/purchase/invoices/:invoiceId/edit"
              element={<PurchaseInvoiceFormPage />}
            />

            {/* Sales */}
            <Route path="/sales/orders" element={<SalesOrders />} />
            <Route path="/sales/orders/new" element={<SalesOrderFormPage />} />
            <Route
              path="/sales/orders/:orderId/edit"
              element={<SalesOrderFormPage />}
            />
            <Route path="/sales/invoices" element={<SalesInvoices />} />
            <Route
              path="/sales/invoices/new"
              element={<SalesInvoiceFormPage />}
            />
            <Route
              path="/sales/invoices/new-2"
              element={<SalesInvoiceFormPage2 />}
            />
            <Route
              path="/sales/invoices/:invoiceId/edit"
              element={<SalesInvoiceFormPage />}
            />

            {/* Accounting */}
            <Route path="/accounting/accounts" element={<ChartOfAccounts />} />
            <Route path="/accounting/ledgers" element={<Ledgers />} />
            <Route path="/accounting/vouchers" element={<VouchersHub />} />
            <Route
              path="/accounting/vouchers/:type"
              element={<VoucherTypeList />}
            />
            <Route
              path="/accounting/vouchers/:type/new"
              element={<VoucherEntryForm />}
            />
            <Route path="/accounting/payments" element={<Payments />} />
            <Route
              path="/accounting/trial-balance"
              element={<TrialBalance />}
            />
            <Route
              path="/accounting/profit-and-loss"
              element={<ProfitAndLoss />}
            />
            <Route
              path="/accounting/balance-sheet"
              element={<BalanceSheet />}
            />

            {/* Reports — Account Books */}
            <Route
              path="/reports/account-books/cash-book"
              element={<CashBook />}
            />
            <Route
              path="/reports/account-books/bank-book"
              element={<BankBook />}
            />
            <Route
              path="/reports/account-books/ledger"
              element={<LedgerBook />}
            />
            <Route
              path="/reports/account-books/day-book"
              element={<DayBook />}
            />

            {/* Settings */}
            <Route path="/settings/base" element={<Settings />} />

            <Route path="/settings/theme" element={<Theme />} />
            <Route path="/settings/invoice" element={<InvoiceSettings />} />
            <Route
              path="/settings/thermal-templates"
              element={<ThermalTemplateEditor />}
            />
            <Route
              path="/settings/financial-years"
              element={<FinancialYears />}
            />
            <Route path="/settings/units" element={<Units />} />
            <Route path="/settings/inventory" element={<InventorySettings />} />
          </Route>

          {/* POS — full screen, no ERP shell */}
          <Route
            path="/pos"
            element={
              <RequireAuth>
                <POSPage />
              </RequireAuth>
            }
          />

          {/* POS-2 — full screen, no ERP shell */}
          <Route
            path="/pos2"
            element={
              <RequireAuth>
                <POSPage2 />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
