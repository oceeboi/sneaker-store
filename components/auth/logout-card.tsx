'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AuthService } from '@/services/auth.service';

type LogoutState = { kind: 'loading'; message: string } | { kind: 'error'; message: string };

export function LogoutCard() {
  const router = useRouter();
  const authService = new AuthService();
  const hasAttemptedRef = useRef(false);

  const [state, setState] = useState<LogoutState>({
    kind: 'loading',
    message: 'Signing you out...',
  });

  useEffect(() => {
    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    authService
      .logout()
      .then(() => {
        router.replace('/login');
      })
      .catch(() => {
        setState({
          kind: 'error',
          message: 'Could not sign out automatically. Please try again.',
        });
      });
  }, [authService, router]);

  return (
    <div className="w-full rounded border border-gray-300 bg-gray-50 p-4 text-sm text-gray-900">
      <p>{state.message}</p>
    </div>
  );
}
