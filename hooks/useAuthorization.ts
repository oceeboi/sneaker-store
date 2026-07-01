import { hasPermission, hasRole, hasAllPermissions, UserRole, Permission } from '@/config/rbac';
import { useSession } from '@/lib/context/SessionContext';

// ─── Core hooks ───────────────────────────────────────────────────────────────

export function useRole(): UserRole | null {
  const sessionrole = useSession();
  return sessionrole.role;
}

export function useHasPermission(permission: Permission): boolean {
  const role = useRole();
  if (!role) return false;
  return hasPermission(role, permission);
}

export function useHasAllPermissions(permissions: Permission[]): boolean {
  const role = useRole();
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

export function useHasRole(allowed: UserRole[]): boolean {
  const role = useRole();
  if (!role) return false;
  return hasRole(role, allowed);
}

// ─── Convenience shortcuts ────────────────────────────────────────────────────

export function useIsAdmin(): boolean {
  return useHasRole([UserRole.ADMIN]);
}

export function useIsSupport(): boolean {
  return useHasRole([UserRole.ADMIN, UserRole.SUPPORT]);
}

export function useIsModerator(): boolean {
  return useHasRole([UserRole.ADMIN, UserRole.MODERATOR]);
}

export function useCanTrade(): boolean {
  return useHasPermission(Permission.TRADES_WRITE);
}

export function useCanViewAnyAccount(): boolean {
  return useHasPermission(Permission.ACCOUNTS_READ_ANY);
}
