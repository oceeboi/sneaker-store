export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/whats-new',
] as const;

export const DEFAULT_AUTHENTICATED_REDIRECT = '/dashboard';
export const DEFAULT_UNAUTHENTICATED_REDIRECT = '/login';

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}
