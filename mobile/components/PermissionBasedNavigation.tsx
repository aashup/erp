/**
 * Example: Permission-Based Navigation for Mobile
 *
 * This component demonstrates how to use the permission-filtered menu
 * in your mobile app navigation (drawer, tabs, or stack).
 *
 * Usage:
 * 1. Import MENU_CONFIG from config/menuConfig
 * 2. Use usePermissions() to get filtered menu items
 * 3. Render the menu items in your navigation structure (drawer, tabs, etc.)
 *
 * Note: This is a reference implementation. Adapt it to your actual navigation
 * structure (expo-router, react-navigation, etc.)
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';
import { MENU_CONFIG, type MenuItem } from '@/config/menuConfig';

interface NavItemProps {
  item: MenuItem;
  level?: number;
  onNavigate?: (href: string) => void;
}

/**
 * Recursive component to render menu items with proper indentation
 */
function NavItem({ item, level = 0, onNavigate }: NavItemProps) {
  const hasChildren = item.children && item.children.length > 0;

  return (
    <View>
      {item.href && (
        <TouchableOpacity
          onPress={() => onNavigate?.(item.href!)}
          style={[styles.menuItem, { paddingLeft: 16 + level * 16 }]}
        >
          <Text style={styles.menuItemText}>{item.label}</Text>
        </TouchableOpacity>
      )}

      {!item.href && (
        <Text style={[styles.menuGroupLabel, { paddingLeft: 16 + level * 16 }]}>
          {item.label}
        </Text>
      )}

      {hasChildren && (
        <View>
          {item.children!.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              level={level + 1}
              onNavigate={onNavigate}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface PermissionBasedNavigationProps {
  onNavigate?: (href: string) => void;
}

/**
 * Main component that renders the permission-filtered menu
 *
 * Usage in your navigation drawer:
 * <PermissionBasedNavigation onNavigate={(href) => navigation.navigate(href)} />
 */
export function PermissionBasedNavigation({ onNavigate }: PermissionBasedNavigationProps) {
  const { getVisibleMenuItems } = usePermissions();
  const visibleMenu = getVisibleMenuItems(MENU_CONFIG);

  return (
    <ScrollView style={styles.container}>
      {visibleMenu.map((item) => (
        <NavItem key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuGroupLabel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    textTransform: 'uppercase',
    backgroundColor: '#f5f5f5',
    marginTop: 8,
  },
});

/**
 * Integration Example with expo-router:
 *
 * Create a file: mobile/app/(drawer)/_layout.tsx
 *
 * import { GestureHandlerRootView } from 'react-native-gesture-handler';
 * import { DrawerNavigationProp } from '@react-navigation/drawer';
 * import { Drawer } from 'expo-router/drawer';
 * import { PermissionBasedNavigation } from '@/components/PermissionBasedNavigation';
 *
 * export default function Layout() {
 *   const navigation = useNavigation<DrawerNavigationProp<any>>();
 *
 *   return (
 *     <GestureHandlerRootView style={{ flex: 1 }}>
 *       <Drawer
 *         screenOptions={{
 *           drawerContent: (props) => (
 *             <PermissionBasedNavigation
 *               onNavigate={(href) => {
 *                 navigation.navigate(href);
 *                 props.navigation.closeDrawer();
 *               }}
 *             />
 *           ),
 *         }}
 *       >
 *         {/* Define your drawer screens here */}
 *       </Drawer>
 *     </GestureHandlerRootView>
 *   );
 * }
 *
 * Alternative: Tab Navigation
 *
 * Create a file: mobile/app/(tabs)/_layout.tsx
 *
 * import { Tabs } from 'expo-router';
 * import { usePermissions } from '@/hooks/usePermissions';
 * import { MENU_CONFIG } from '@/config/menuConfig';
 *
 * export default function Layout() {
 *   const { getVisibleMenuItems } = usePermissions();
 *   const visibleMenu = getVisibleMenuItems(MENU_CONFIG);
 *
 *   return (
 *     <Tabs>
 *       {visibleMenu.map((item) => (
 *         <Tabs.Screen
 *           key={item.id}
 *           name={item.href}
 *           options={{ title: item.label }}
 *         />
 *       ))}
 *     </Tabs>
 *   );
 * }
 */
