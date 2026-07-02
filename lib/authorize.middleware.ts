import { err, type ApiResponse } from '@/lib/auth/response';
import { authenticateRequest } from '@/lib/auth.middleware';
import { type UserRole, type Permission, hasPermission, hasAllPermissions } from '@/config/rbac';

type AuthorizedUser = {
  userId: string;
  username: string;
  role: UserRole;
};

type RouteAuthorizationResult =
  { ok: true; user: AuthorizedUser } | { ok: false; response: Response };

export type { AuthorizedUser };

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

export async function requireAuthenticatedUser(): Promise<RouteAuthorizationResult> {
  const auth_result = await authenticateRequest();

  if ('error' in auth_result) {
    return {
      ok: false,
      response: err(auth_result.error ?? 'Unauthorized', 401) as Response,
    };
  }

  return {
    ok: true,
    user: {
      userId: auth_result.userId,
      username: auth_result.username,
      role: auth_result.role,
    },
  };
}

export async function requirePermission(permission: Permission): Promise<RouteAuthorizationResult> {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) {
    return authenticated;
  }

  const authorized = authorizeRequest(authenticated.user, permission);
  if (!authorized.ok) {
    return {
      ok: false,
      response: err(authorized.message, authorized.status) as Response,
    };
  }

  return authenticated;
}

export async function requireAllPermissions(
  permissions: Permission[]
): Promise<RouteAuthorizationResult> {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) {
    return authenticated;
  }

  const authorized = authorizeAll(authenticated.user, permissions);
  if (!authorized.ok) {
    return {
      ok: false,
      response: err(authorized.message, authorized.status) as Response,
    };
  }

  return authenticated;
}
