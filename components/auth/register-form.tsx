'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, Input, PasswordInput } from '@/components/shared/form';
import { AuthService } from '@/services/auth.service';

const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .toLowerCase()
    .trim(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .trim()
    .toLowerCase()
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  referralcode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    // .refine((value) => value.length === 0 || /^(?=.{3,30}$)[a-zA-Z0-9_]+$/.test(value), {
    //   message:
    //     'Referral code must be 3-30 characters and contain only letters, numbers, or underscores',
    // })
    .optional()
    .or(z.literal('')),
});

type RegisterFields = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const authService = new AuthService();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      username: '',
      password: '',
      referralcode: '',
    },
  });

  const onSubmit = async (data: RegisterFields) => {
    const result = await authService.register(data);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message || 'Account created successfully');
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email address" error={errors.email?.message} delay={100} xx={true}>
          <Input
            {...register('email')}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            hasError={!!errors.email}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Username" error={errors.username?.message} delay={150} xx={true}>
          <Input
            {...register('username')}
            type="text"
            placeholder="your_username"
            autoComplete="username"
            hasError={!!errors.username}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} delay={200} xx={true}>
          <PasswordInput
            {...register('password')}
            placeholder="Create a strong password"
            autoComplete="new-password"
            hasError={!!errors.password}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Referral code (optional)" error={errors.referralcode?.message} delay={250}>
          <Input
            {...register('referralcode')}
            type="text"
            placeholder="ABC123"
            hasError={!!errors.referralcode}
            disabled={isSubmitting}
          />
        </Field>

        <p className="text-sm text-gray-600">
          Your personal data will be used to support your experience throughout this website and to
          manage access to your account. Read our
          <Link href="/privacy-policy" className="ml-1 font-semibold text-black hover:underline">
            privacy policy
          </Link>
          .
        </p>

        <button
          type="submit"
          className={`w-full py-3 rounded text-white font-semibold text-sm transition-all duration-200 ${
            isSubmitting ? 'bg-black/50 cursor-not-allowed' : 'bg-black hover:bg-black/90'
          }`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
