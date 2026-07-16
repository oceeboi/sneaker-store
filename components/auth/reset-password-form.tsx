'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, PasswordInput } from '@/components/shared/form';
import { AuthService } from '@/services/auth.service';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFields = z.infer<typeof resetPasswordSchema>;

type TokenState = { kind: 'checking' } | { kind: 'valid' } | { kind: 'invalid'; message: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const authService = useMemo(() => new AuthService(), []);

  const token = searchParams.get('token')?.trim() ?? '';
  const [tokenState, setTokenState] = useState<TokenState>({ kind: 'checking' });

  useEffect(() => {
    let is_active = true;

    if (!token) {
      setTokenState({
        kind: 'invalid',
        message: 'This reset link is missing a token. Please request a new reset email.',
      });
      return;
    }

    setTokenState({ kind: 'checking' });

    authService.validateResetToken(token).then((result) => {
      if (!is_active) return;

      if (!result.success) {
        setTokenState({ kind: 'invalid', message: result.message });
        return;
      }

      setTokenState({ kind: 'valid' });
    });

    return () => {
      is_active = false;
    };
  }, [authService, token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFields>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFields) => {
    if (!token || tokenState.kind !== 'valid') {
      toast.error('Reset token is invalid or expired. Please request a new reset link.');
      return;
    }

    const result = await authService.resetPassword({ token, ...data });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message || 'Password updated successfully.');
    router.push('/login');
  };

  if (tokenState.kind === 'checking') {
    return (
      <div className="w-full rounded border border-gray-300 bg-gray-50 p-4 text-sm text-gray-900">
        Validating your reset link. Please wait...
      </div>
    );
  }

  if (tokenState.kind === 'invalid') {
    return (
      <div className="w-full rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {tokenState.message}
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password?.message} delay={100} xx={true}>
          <PasswordInput
            {...register('password')}
            placeholder="Enter your new password"
            autoComplete="new-password"
            hasError={!!errors.password}
            disabled={isSubmitting}
          />
        </Field>

        <Field
          label="Confirm password"
          error={errors.confirmPassword?.message}
          delay={200}
          xx={true}
        >
          <PasswordInput
            {...register('confirmPassword')}
            placeholder="Confirm your new password"
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            disabled={isSubmitting}
          />
        </Field>

        <button
          type="submit"
          className={`w-full py-3 rounded text-white font-semibold text-sm transition-all duration-200 ${
            isSubmitting ? 'bg-black/50 cursor-not-allowed' : 'bg-black hover:bg-black/90'
          }`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating password...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
