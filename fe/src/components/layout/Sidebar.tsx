import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  IndianRupee,
  BookOpen,
  Users,
  Warehouse,
  Building2,
  Settings,
  Calendar,
  X,
  BarChart3,
  BookOpenCheck,
  ArrowLeftRight,
  ClipboardEdit,
  PackageOpen,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Inventory',
    children: [
      { name: 'Stock Summary', href: '/inventory/stock-summary', icon: BarChart3 },
      { name: 'Stock Ledger', href: '/inventory/stock-ledger', icon: BookOpenCheck },
      { name: 'Items', href: '/inventory/items', icon: Package },
      { name: 'Godowns', href: '/inventory/godowns', icon: Warehouse },
      { name: 'Stock Transfer', href: '/inventory/stock-transfer', icon: ArrowLeftRight },
      { name: 'Adjustment', href: '/inventory/stock-adjustment', icon: ClipboardEdit },
      { name: 'Opening Stock', href: '/inventory/opening-stock', icon: PackageOpen },
    ],
  },
  { name: 'Parties', href: '/parties', icon: Users },
  {
    name: 'Purchase',
    children: [
      { name: 'Purchase Orders', href: '/purchase/orders', icon: ShoppingCart },
      { name: 'Purchase Invoices', href: '/purchase/invoices', icon: ShoppingCart },
    ],
  },
  {
    name: 'Sales',
    children: [
      { name: 'Sales Orders', href: '/sales/orders', icon: IndianRupee },
      { name: 'Sales Invoices', href: '/sales/invoices', icon: IndianRupee },
    ],
  },
  {
    name: 'Accounting',
    children: [
      { name: 'Chart of Accounts', href: '/accounting/accounts', icon: BookOpen },
      { name: 'Journal Entries', href: '/accounting/journals', icon: BookOpen },
      { name: 'Payments & Receipts', href: '/accounting/payments', icon: IndianRupee },
    ],
  },
  { name: 'Branches', href: '/branches', icon: Building2 },
  {
    name: 'Settings',
    children: [
      { name: 'Base Settings', href: '/settings/base', icon: Settings },
      { name: 'Financial Years', href: '/settings/financial-years', icon: Calendar },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const companyName = useAuthStore((state) => state.user?.company?.name?.trim() || 'ERP');
  const companyInitial = companyName.charAt(0).toUpperCase();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-300 ease-in-out',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6 border-gray-200 dark:border-gray-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
            {companyInitial}
          </div>
          <span className="truncate text-lg font-bold text-gray-900 dark:text-white">
            {companyName}
          </span>
          {mobileOpen && (
            <button
              onClick={onClose}
              className="ml-auto rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigation.map((item) =>
            'children' in item ? (
              <div key={item.name} className="pt-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {item.name}
                </p>
                {item.children?.map((child) => (
                  <NavLink
                    key={child.href}
                    to={child.href}
                    className={() =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive(child.href)
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                      )
                    }
                  >
                    <child.icon className="h-4 w-4" />
                    {child.name}
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink
                key={item.href}
                to={item.href}
                className={() =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </NavLink>
            )
          )}
        </nav>
      </aside>
    </>
  );
}
