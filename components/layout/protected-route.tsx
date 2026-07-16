'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isPublicRoute, DEFAULT_UNAUTHENTICATED_REDIRECT } from '@/config/routes';
import { useSession } from '@/lib/context/SessionContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated' && !isPublicRoute(pathname)) {
      router.replace(DEFAULT_UNAUTHENTICATED_REDIRECT);
    }
  }, [status, pathname, router]);

  if (isPublicRoute(pathname)) return <>{children}</>;

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') return null;

  return <>{children}</>;
}
