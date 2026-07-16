'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, Input, PasswordInput } from '@/components/shared/form';
import { AuthService } from '@/services/auth.service';

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Username or email is required')
    .refine(
      (v) => (v.includes('@') ? z.string().email().safeParse(v).success : v.length >= 3),
      'Enter a valid email or username (min 3 chars)'
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFields = z.infer<typeof loginSchema>;

function normalizeReturnTo(rawReturnTo: string | null): string | null {
  if (!rawReturnTo) return null;

  try {
    const decoded = decodeURIComponent(rawReturnTo);
    if (!decoded.startsWith('/')) return null;
    if (decoded.startsWith('//')) return null;
    if (decoded.startsWith('/api/')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const authService = new AuthService();

  const returnToPath = normalizeReturnTo(searchParams.get('returnTo'));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = async (data: LoginFields) => {
    const result = await authService.login(data);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message || 'Login successful');
    router.push(returnToPath ?? '/dashboard');
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Username or email" error={errors.identifier?.message} delay={100} xx={true}>
          <Input
            {...register('identifier')}
            type="text"
            placeholder="you@example.com or your username"
            autoComplete="username"
            hasError={!!errors.identifier}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} delay={200} xx={true}>
          <PasswordInput
            {...register('password')}
            placeholder="Enter your password"
            autoComplete="current-password"
            hasError={!!errors.password}
            disabled={isSubmitting}
          />
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-black hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <button
          type="submit"
          className={`w-full py-3 rounded text-white font-semibold text-sm transition-all duration-200 ${
            isSubmitting ? 'bg-black/50 cursor-not-allowed' : 'bg-black hover:bg-black/90'
          }`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
