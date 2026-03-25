import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
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
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Inventory',
    children: [
      { name: 'Items', href: '/inventory/items', icon: Package },
      { name: 'Godowns', href: '/inventory/godowns', icon: Warehouse },
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
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { theme } = useTheme();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r ${
        theme === 'dark'
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`flex h-16 items-center gap-2 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        } px-6`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
          E
        </div>
        <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>ERP</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) =>
          'children' in item ? (
            <div key={item.name} className="pt-3">
              <p
                className={`px-3 pb-1 text-xs font-semibold uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {item.name}
              </p>
              {item.children?.map((child) => (
                <NavLink
                  key={child.href}
                  to={child.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
  );
}
