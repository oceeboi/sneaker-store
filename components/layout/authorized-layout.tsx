'use client';

import { useHasPermission, useHasRole, useHasAllPermissions } from '@/hooks/useAuthorization';
import type { Permission, UserRole } from '@/config/rbac';

type AuthorizedProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
} & (
  | { permission: Permission; permissions?: never; roles?: never }
  | { permissions: Permission[]; permission?: never; roles?: never }
  | { roles: UserRole[]; permission?: never; permissions?: never }
);

export function Authorized({ children, fallback = null, ...guard }: AuthorizedProps) {
  const hasP = useHasPermission(guard.permission!);
  const hasPs = useHasAllPermissions(guard.permissions ?? []);
  const hasR = useHasRole(guard.roles ?? []);

  const allowed =
    (guard.permission !== undefined && hasP) ||
    (guard.permissions !== undefined && hasPs) ||
    (guard.roles !== undefined && hasR);

  return <>{allowed ? children : fallback}</>;
}
