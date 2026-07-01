import { type UserRole, type Permission, hasPermission, hasAllPermissions } from '@/config/rbac';

type AuthorizedUser = {
  userId: string;
  username: string;
  role: UserRole;
};

type AuthorizeResult =
  { ok: true; user: AuthorizedUser } | { ok: false; status: 403; message: string };

// ─── Single permission check ──────────────────────────────────────────────────

export function authorizeRequest(user: AuthorizedUser, permission: Permission): AuthorizeResult {
  if (!hasPermission(user.role, permission)) {
    return {
      ok: false,
      status: 403,
      message: `Your role (${user.role}) does not have permission: ${permission}`,
    };
  }
  return { ok: true, user };
}

// ─── Multiple permission check (must have ALL) ────────────────────────────────

export function authorizeAll(user: AuthorizedUser, permissions: Permission[]): AuthorizeResult {
  if (!hasAllPermissions(user.role, permissions)) {
    return {
      ok: false,
      status: 403,
      message: `Insufficient permissions for this action.`,
    };
  }
  return { ok: true, user };
}

// ─── Convenience: build a 403 NextResponse ────────────────────────────────────

export function forbiddenResponse(message: string): Response {
  return Response.json({ success: false, message }, { status: 403 });
}
