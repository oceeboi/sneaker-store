'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import type { UserRole } from '@/config/rbac';

import {
  isPublicRoute,
  DEFAULT_UNAUTHENTICATED_REDIRECT,
  DEFAULT_AUTHENTICATED_REDIRECT,
} from '@/config/routes';

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionContextValue = {
  status: SessionStatus;
  isAuthenticated: boolean;
  role: UserRole | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const authService = new AuthService();
const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000; // 14mins

const SessionContext = createContext<SessionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const [role, setRole] = useState<UserRole | null>(null);

  const onPublicRoute = isPublicRoute(pathname);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearInterval(intervalRef.current!);
    await authService.logout();
    setRole(null);
    if (isMounted.current) setStatus('unauthenticated');
    router.replace(DEFAULT_UNAUTHENTICATED_REDIRECT);
  }, [router]);

  // ── Silent refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const result = await authService.refresh();

    if (!isMounted.current) return;

    if (result.success) {
      setStatus('authenticated');

      setRole(result.role);

      // Authenticated user landed on a public/auth route (e.g. typed /login manually)
      // — send them to the app.
      if (onPublicRoute) {
        router.replace(DEFAULT_AUTHENTICATED_REDIRECT);
      }
      return;
    }

    if (result.shouldLogout) {
      clearInterval(intervalRef.current!);
      setStatus('unauthenticated');

      // Only redirect to login with a reason if they were on a protected route.
      // On public routes, just let them stay — they're already where they need to be.
      if (!onPublicRoute) {
        router.replace(
          `${DEFAULT_UNAUTHENTICATED_REDIRECT}?reason=${encodeURIComponent(result.message)}`
        );
      }
      return;
    }

    // Network/server error — don't log out, next tick retries.
    console.warn('[session] refresh failed, will retry:', result.message);
  }, [router, onPublicRoute]);

  // ── Bootstrap + rotation interval ─────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    // Schedule the initial refresh to avoid calling setState synchronously inside the effect.
    const timer = setTimeout(() => {
      // trigger an async refresh; interval starts after initial run is scheduled
      void refresh();
      intervalRef.current = setInterval(refresh, ACCESS_TOKEN_TTL_MS);
    }, 0);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      clearInterval(intervalRef.current!);
    };
  }, [refresh]);

  const value: SessionContextValue = {
    role,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    logout,
    refresh,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a <SessionProvider>');
  return ctx;
}
