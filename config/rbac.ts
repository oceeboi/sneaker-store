// ─── Single source of truth for the entire RBAC system ───────────────────────
// Every role, permission, and route mapping lives here.
// proxy.ts, authorize.middleware.ts, and client hooks all import from this file.

// autor: ocee,
// note: please be very carefull here

export const UserRole = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPPORT: 'support',
  MODERATOR: 'moderator',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─── Permissions ──────────────────────────────────────────────────────────────
// Format: resource:action
// Naming is deliberate — resource = what, action = what you can do to it.

export const Permission = {
  // Catalog
  BRANDS_READ: 'brands:read',
  BRANDS_WRITE: 'brands:write',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_WRITE: 'categories:write',
  COLLECTIONS_READ: 'collections:read',
  COLLECTIONS_WRITE: 'collections:write',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',

  // Trades
  TRADES_READ: 'trades:read',
  TRADES_WRITE: 'trades:write',
  TRADES_READ_ANY: 'trades:read_any', // own vs any user's trades

  // Accounts
  ACCOUNTS_READ: 'accounts:read',
  ACCOUNTS_WRITE: 'accounts:write',
  ACCOUNTS_READ_ANY: 'accounts:read_any',
  ACCOUNTS_SUSPEND: 'accounts:suspend',

  // Financials
  FINANCIALS_READ: 'financials:read',
  FINANCIALS_READ_ANY: 'financials:read_any',
  FINANCIALS_WRITE: 'financials:write',

  // Content (forum posts, comments, reports)
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  CONTENT_MODERATE: 'content:moderate', // delete/flag/pin any content
  CONTENT_DELETE_ANY: 'content:delete_any',

  // Support
  SUPPORT_TICKETS_READ: 'support:tickets_read',
  SUPPORT_TICKETS_WRITE: 'support:tickets_write',

  // Admin
  ADMIN_PANEL: 'admin:panel',
  AUDIT_LOGS_READ: 'audit:read',
  ROLES_WRITE: 'roles:write',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// ─── Role → permission grants ─────────────────────────────────────────────────
// The authoritative grant table. authorizeRequest() reads this.

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CUSTOMER]: [
    Permission.TRADES_READ,
    Permission.TRADES_WRITE,
    Permission.ACCOUNTS_READ,
    Permission.FINANCIALS_READ,
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.SUPPORT_TICKETS_READ,
    Permission.SUPPORT_TICKETS_WRITE,
  ],

  [UserRole.SUPPORT]: [
    // Read-only on user data + financials — no write access to anything financial
    Permission.TRADES_READ,
    Permission.TRADES_READ_ANY,
    Permission.ACCOUNTS_READ,
    Permission.ACCOUNTS_READ_ANY,
    Permission.FINANCIALS_READ,
    Permission.FINANCIALS_READ_ANY,
    Permission.CONTENT_READ,
    Permission.SUPPORT_TICKETS_READ,
    Permission.SUPPORT_TICKETS_WRITE,
  ],

  [UserRole.MODERATOR]: [
    // Content only — no visibility into accounts or financials
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.CONTENT_MODERATE,
    Permission.CONTENT_DELETE_ANY,
    Permission.SUPPORT_TICKETS_READ,
  ],

  [UserRole.ADMIN]: Object.values(Permission) as Permission[], // full access
};

// ─── Route permission map ─────────────────────────────────────────────────────
// Used by proxy.ts at the edge.
// - `roles` guards by role directly (coarse — for whole sections like /admin)
// - `permissions` guards by capability (fine-grained — preferred)
// - `allowUnauthenticated` marks public routes that skip all checks

export type RouteGuard = {
  path: string; // matched as pathname.startsWith(path)
  roles?: UserRole[]; // any of these roles can access
  permissions?: Permission[]; // user must have ALL of these
  allowUnauthenticated?: boolean; // skip auth entirely
};

export const ROUTE_GUARDS: RouteGuard[] = [
  // ── Public (no auth required) ─────────────────────────────────────────────
  { path: '/login', allowUnauthenticated: true },
  { path: '/register', allowUnauthenticated: true },
  { path: '/forgot-password', allowUnauthenticated: true },
  { path: '/reset-password', allowUnauthenticated: true },
  { path: '/verify-email', allowUnauthenticated: true },

  // ── Admin panel ───────────────────────────────────────────────────────────
  { path: '/admin', roles: [UserRole.ADMIN] },

  // ── Moderation ────────────────────────────────────────────────────────────
  { path: '/moderate', roles: [UserRole.ADMIN, UserRole.MODERATOR] },

  // ── Support dashboard ─────────────────────────────────────────────────────
  { path: '/support', roles: [UserRole.ADMIN, UserRole.SUPPORT] },

  // ── Trading (authenticated customers + admin) ─────────────────────────────
  { path: '/trade', permissions: [Permission.TRADES_READ] },
  { path: '/portfolio', permissions: [Permission.FINANCIALS_READ] },

  // ── Account settings (own) ────────────────────────────────────────────────
  { path: '/settings', permissions: [Permission.ACCOUNTS_READ] },

  // ── Dashboard (all authenticated users) ───────────────────────────────────
  {
    path: '/dashboard',
    roles: [UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT, UserRole.MODERATOR],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function hasRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}

export function getRouteGuard(pathname: string): RouteGuard | undefined {
  // Most specific match wins (longest matching path prefix)
  return [...ROUTE_GUARDS]
    .filter((g) => pathname.startsWith(g.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
