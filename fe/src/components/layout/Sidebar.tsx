import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { MENU_CONFIG, type MenuItem } from '@/config/menuConfig';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  BookOpen,
  Users,
  UserCog,
  Warehouse,
  Building2,
  Settings,
  Ruler,
  Calendar,
  X,
  BarChart3,
  BookOpenCheck,
  ClipboardEdit,
  Scale,
  TrendingUp,
  Palette,
  FileText,
  Landmark,
  CalendarDays,
  BookMarked,
} from 'lucide-react';

/**
 * Map icon names from menuConfig to lucide icon components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  'grid': LayoutDashboard,
  'box': Package,
  'folder': FolderTree,
  'shopping-cart': ShoppingCart,
  'trending-up': TrendingUp,
  'book-open': BookOpen,
  'users': Users,
  'user-cog': UserCog,
  'warehouse': Warehouse,
  'building': Building2,
  'settings': Settings,
  'ruler': Ruler,
  'calendar': Calendar,
  'bar-chart': BarChart3,
  'book-check': BookOpenCheck,
  'clipboard': ClipboardEdit,
  'scale': Scale,
  'palette': Palette,
  'file-text': FileText,
  'landmark': Landmark,
  'calendar-days': CalendarDays,
  'book-marked': BookMarked,
};

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  sidebarVisible?: boolean;
}

export function Sidebar({ mobileOpen = false, onClose, sidebarVisible = true }: SidebarProps) {
  const location = useLocation();
  const companyName = useAuthStore((state) => state.user?.company?.name?.trim() || 'ERP');
  const companyInitial = companyName.charAt(0).toUpperCase();
  const { getVisibleMenuItems } = usePermissions();

  const visibleMenu = getVisibleMenuItems(MENU_CONFIG);

  const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return LayoutDashboard;
    return ICON_MAP[iconName] || LayoutDashboard;
  };

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const renderMenuItem = (item: MenuItem) => {
    const Icon = getIcon(item.icon);

    if (item.children && item.children.length > 0) {
      // Parent menu item with children
      return (
        <div key={item.id} className="pt-3">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {item.label}
          </p>
          {item.children.map((child) => (
            <NavLink
              key={child.id}
              to={child.href || '#'}
              className={() =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(child.href || '')
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {child.label}
            </NavLink>
          ))}
        </div>
      );
    }

    // Single menu item without children
    return (
      <NavLink
        key={item.id}
        to={item.href || '#'}
        className={() =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(item.href || '')
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          )
        }
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </NavLink>
    );
  };

  return (
    <>
      {/* Overlay - shown when sidebar overlay is open (mobile or hidden sidebar on desktop) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      {/* Desktop overlay when sidebar is hidden */}
      {mobileOpen && !sidebarVisible && (
        <div
          className="fixed inset-0 z-30 bg-black/50 hidden md:block"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-300 ease-in-out',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
          mobileOpen ? 'translate-x-0' : !sidebarVisible ? '-translate-x-full md:-translate-x-full' : '-translate-x-full md:translate-x-0'
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
          {visibleMenu.map((item) => renderMenuItem(item))}
        </nav>
      </aside>
    </>
  );
}
