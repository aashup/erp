import { usePermissions } from '@/hooks/usePermissions';

interface Props {
  permission: string;
  children: React.ReactNode;
}

export function CanAccess({ permission, children }: Props) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}
