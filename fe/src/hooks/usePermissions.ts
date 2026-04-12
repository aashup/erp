/**
 * Hook for checking user permissions and filtering menu items
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

import type { MenuItem } from "@/config/menuConfig";
import { useAuthStore } from "@/store/authStore";

export function usePermissions() {
  const { user } = useAuthStore();

  // If user has no permissions loaded yet (e.g. seeder not run, or old session),
  // treat as having all permissions so the menu is fully visible
  const hasNoPermissions = !user?.permissions || user.permissions.length === 0;

  /**
   * Check if user has a specific permission.
   * Returns true if no permissions are loaded (fallback: show everything).
   */
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (hasNoPermissions) return false;
    return user.permissions!.includes(permission);
  };

  /**
   * Recursively filter menu items based on user permissions.
   * - Removes items where requiredPermission is not granted
   * - Removes parent items if all children are filtered out
   */
  const getVisibleMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter((item) => {
        if (!item.requiredPermission) return true;
        return hasPermission(item.requiredPermission);
      })
      .map((item) => ({
        ...item,
        children: item.children
          ? getVisibleMenuItems(item.children)
          : undefined,
      }))
      .filter((item) => {
        if (item.children) return item.children.length > 0;
        return true;
      });
  };

  return {
    hasPermission,
    getVisibleMenuItems,
    userPermissions: user?.permissions || [],
  };
}
