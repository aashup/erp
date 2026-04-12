/**
 * Hook for checking user permissions and filtering menu items
 * Shared between web and mobile apps
 *
 * Usage:
 *   const { hasPermission, getVisibleMenuItems } = usePermissions();
 *
 *   // Check single permission
 *   if (hasPermission('inventory.view')) {
 *     // Show inventory module
 *   }
 *
 *   // Filter menu items
 *   const visibleMenu = getVisibleMenuItems(MENU_CONFIG);
 */

import type { MenuItem } from '@/config/menuConfig';
import { useAuthStore } from '@/store/authStore';

export function usePermissions() {
  const { user } = useAuthStore();

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
  };

  /**
   * Recursively filter menu items based on user permissions
   * - Removes items where requiredPermission is not granted
   * - Removes parent items if all children are filtered out
   */
  const getVisibleMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => {
        // If item has no permission requirement, always show
        if (!item.requiredPermission) return true;
        // Otherwise, only show if user has permission
        return hasPermission(item.requiredPermission);
      })
      .map(item => ({
        ...item,
        // Recursively filter children
        children: item.children ? getVisibleMenuItems(item.children) : undefined,
      }))
      .filter(item => {
        // If item has children, only show if it has children after filtering
        if (item.children) return item.children.length > 0;
        // If no children, show it
        return true;
      });
  };

  return {
    hasPermission,
    getVisibleMenuItems,
    userPermissions: user?.permissions || [],
  };
}
