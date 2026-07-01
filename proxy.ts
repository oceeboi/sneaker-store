import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/tokens';
import {
  getRouteGuard,
  hasAllPermissions,
  hasRole,
  type UserRole,
  type Permission,
} from '@/config/rbac';

const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || 'access_token';
const LOGIN_PATH = '/login';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const guard = getRouteGuard(pathname);

  // No guard defined → allow through (API routes, _next/static, etc.)
  if (!guard) return NextResponse.next();

  // Public route → allow through immediately
  if (guard.allowUnauthenticated) return NextResponse.next();

  // Authenticated route → verify token
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(req, 'Please sign in to continue.');
  }

  const verification = verifyAccessToken(token);

  if (!verification.ok) {
    return redirectToLogin(
      req,
      verification.reason === 'expired'
        ? 'Your session has expired. Please sign in again.'
        : 'Invalid session. Please sign in again.'
    );
  }

  const { role } = verification.payload as { role: UserRole };

  // Role check (coarse — whole sections)
  if (guard.roles && !hasRole(role, guard.roles)) {
    return forbidden(req);
  }

  // Permission check (fine-grained — capability based)
  if (guard.permissions && !hasAllPermissions(role, guard.permissions as Permission[])) {
    return forbidden(req);
  }

  // Attach role to request headers so server components can read it
  // without re-verifying the JWT
  const response = NextResponse.next();
  response.headers.set('x-user-id', verification.payload.sub);
  response.headers.set('x-user-role', role);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redirectToLogin(req: NextRequest, reason: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set('reason', reason);
  url.searchParams.set('returnTo', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function forbidden(req: NextRequest): NextResponse {
  // Redirect to a 403 page rather than exposing a blank screen
  const url = req.nextUrl.clone();
  url.pathname = '/403';
  return NextResponse.redirect(url);
}
