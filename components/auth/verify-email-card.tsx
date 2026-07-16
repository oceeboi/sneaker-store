'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { AuthService } from '@/services/auth.service';

type VerifyState =
  | { kind: 'loading'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const authService = new AuthService();
  const hasAttemptedRef = useRef(false);

  const [state, setState] = useState<VerifyState>({
    kind: 'loading',
    message: 'Verifying your email, please wait...',
  });

  useEffect(() => {
    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    const token = searchParams.get('token')?.trim();

    if (!token) {
      setState({
        kind: 'error',
        message: 'Verification token is missing. Please request a new verification link.',
      });
      return;
    }

    authService
      .verifyEmail({ token })
      .then((result) => {
        if (!result.success) {
          setState({ kind: 'error', message: result.message });
          return;
        }

        setState({ kind: 'success', message: 'Email verified Successfully' });
      })
      .catch(() => {
        setState({
          kind: 'error',
          message: 'Unable to verify your email right now. Please try again shortly.',
        });
      });
  }, [authService, searchParams]);

  const toneClass =
    state.kind === 'success'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : state.kind === 'error'
        ? 'border-red-300 bg-red-50 text-red-900'
        : 'border-gray-300 bg-gray-50 text-gray-900';

  return (
    <div className={`w-full rounded border p-4 text-sm ${toneClass}`}>
      <p>{state.message}</p>
    </div>
  );
}
