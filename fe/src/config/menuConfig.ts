/**
 * Menu Configuration with Permission-based Rendering
 *
 * Each menu item can have a requiredPermission field.
 * If a user lacks that permission, the item will be hidden.
 *
 * Permission format: 'module.action' (e.g., 'inventory.view', 'sales.create')
 */

export interface MenuItem {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  requiredPermission?: string; // e.g., 'inventory.view'
  children?: MenuItem[];
}

export const MENU_CONFIG: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: "grid",
  },
  {
    id: "pos",
    label: "POS",
    href: "/pos",
    icon: "shopping-cart",
    requiredPermission: "pos.view",
  },
  {
    id: "pos2",
    label: "POS-2",
    href: "/pos2",
    icon: "shopping-cart",
    requiredPermission: "pos.view",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "box",
    requiredPermission: "inventory.view",
    children: [
      {
        id: "stock-summary",
        label: "Stock Summary",
        href: "/inventory/stock-summary",
        requiredPermission: "inventory.view",
      },
      {
        id: "stock-ledger",
        label: "Stock Ledger",
        href: "/inventory/stock-ledger",
        requiredPermission: "inventory.view",
      },
      {
        id: "item-groups",
        label: "Item Groups",
        href: "/inventory/item-groups",
        requiredPermission: "inventory.view",
      },
      {
        id: "items",
        label: "Items",
        href: "/inventory/items",
        requiredPermission: "inventory.view",
      },
      {
        id: "batches",
        label: "Item Batches",
        href: "/inventory/batches",
        requiredPermission: "inventory.view",
      },
      {
        id: "adjustment",
        label: "Stock Adjustment",
        href: "/inventory/stock-adjustment",
        requiredPermission: "inventory.view",
      },
    ],
  },
  {
    id: "parties",
    label: "Parties",
    href: "/parties",
    icon: "users",
    requiredPermission: "party.view",
  },
  {
    id: "purchase",
    label: "Purchase",
    icon: "shopping-cart",
    requiredPermission: "purchase.view",
    children: [
      {
        id: "purchase-orders",
        label: "Orders",
        href: "/purchase/orders",
        requiredPermission: "purchase.view",
      },
      {
        id: "purchase-invoices",
        label: "Invoices",
        href: "/purchase/invoices",
        requiredPermission: "purchase.view",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "trending-up",
    requiredPermission: "sales.view",
    children: [
      {
        id: "sales-orders",
        label: "Orders",
        href: "/sales/orders",
        requiredPermission: "sales.view",
      },
      {
        id: "sales-invoices",
        label: "Invoices",
        href: "/sales/invoices",
        requiredPermission: "sales.view",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "file-text",
    requiredPermission: "accounting.view",
    children: [
      {
        id: "cash-book",
        label: "Cash Book",
        href: "/reports/account-books/cash-book",
        requiredPermission: "accounting.view",
      },
      {
        id: "bank-book",
        label: "Bank Book",
        href: "/reports/account-books/bank-book",
        requiredPermission: "accounting.view",
      },
      {
        id: "ledger-book",
        label: "Ledger",
        href: "/reports/account-books/ledger",
        requiredPermission: "accounting.view",
      },
      {
        id: "day-book",
        label: "Day Book",
        href: "/reports/account-books/day-book",
        requiredPermission: "accounting.view",
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: "book-open",
    requiredPermission: "accounting.view",
    children: [
      {
        id: "chart-of-accounts",
        label: "Chart of Accounts",
        href: "/accounting/accounts",
        requiredPermission: "accounting.view",
      },
      {
        id: "ledgers",
        label: "Ledgers",
        href: "/accounting/ledgers",
        requiredPermission: "accounting.view",
      },
      {
        id: "journal-entry",
        label: "Vouchers",
        href: "/accounting/vouchers",
        requiredPermission: "accounting.view",
      },
      {
        id: "trial-balance",
        label: "Trial Balance",
        href: "/accounting/trial-balance",
        requiredPermission: "accounting.view",
      },
      {
        id: "profit-loss",
        label: "P&L",
        href: "/accounting/profit-and-loss",
        requiredPermission: "accounting.view",
      },
      {
        id: "balance-sheet",
        label: "Balance Sheet",
        href: "/accounting/balance-sheet",
        requiredPermission: "accounting.view",
      },
      // {
      //   id: "payments",
      //   label: "Payments",
      //   href: "/accounting/payments",
      //   requiredPermission: "accounting.view",
      // },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: "users",
    requiredPermission: "payroll.view",
    children: [
      {
        id: "payroll-employees",
        label: "Employees",
        href: "/payroll/employees",
        requiredPermission: "payroll.view",
      },
      // {
      //   id: "payroll-departments",
      //   label: "Departments",
      //   href: "/payroll/departments",
      //   requiredPermission: "payroll.view",
      // },
      {
        id: "payroll-runs",
        label: "Payroll Runs",
        href: "/payroll/runs",
        requiredPermission: "payroll.view",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    requiredPermission: "branch.view",
    children: [
      {
        id: "base-settings",
        label: "Comapny",
        href: "/settings/base",
        requiredPermission: "branch.view",
      },
      {
        id: "theme",
        label: "Theme",
        href: "/settings/theme",
        requiredPermission: "branch.view",
      },
      {
        id: "invoice-settings",
        label: "Invoice",
        href: "/settings/invoice",
        requiredPermission: "branch.view",
      },
      {
        id: "thermal-templates",
        label: "Thermal Templates",
        href: "/settings/thermal-templates",
        requiredPermission: "branch.view",
      },
      {
        id: "branches",
        label: "Branches",
        href: "/branches",
        requiredPermission: "branch.view",
      },
      {
        id: "godowns",
        label: "Godowns",
        href: "/inventory/godowns",
        requiredPermission: "inventory.view",
      },
      {
        id: "inventory-settings",
        label: "Inventory",
        href: "/settings/inventory",
        requiredPermission: "branch.view",
      },
      {
        id: "units",
        label: "Units",
        href: "/settings/units",
        requiredPermission: "branch.view",
      },
      {
        id: "financial-years",
        label: "Financial Years",
        href: "/settings/financial-years",
        requiredPermission: "branch.view",
      },
      {
        id: "payroll-settings",
        label: "Payroll",
        href: "/settings/payroll",
        requiredPermission: "payroll.view",
      },
      {
        id: "tally-import",
        label: "Tally Import",
        href: "/settings/tally-import",
        requiredPermission: "accounting.create",
      },
    ],
  },
  {
    id: "users-groups",
    label: "Users & Groups",
    icon: "user-cog",
    requiredPermission: "user.view",
    children: [
      {
        id: "users",
        label: "Users",
        href: "/users",
        requiredPermission: "user.view",
      },
      {
        id: "groups",
        label: "Groups",
        href: "/groups",
        requiredPermission: "role.view",
      },
    ],
  },
];
