'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, Input } from '@/components/shared/form';
import { AuthService } from '@/services/auth.service';

const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .trim()
    .refine(
      (v) => (v.includes('@') ? z.string().email().safeParse(v).success : v.length >= 3),
      'Enter a valid email address or username'
    ),
});

type ForgotPasswordFields = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const authService = new AuthService();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: '' },
  });

  const onSubmit = async (data: ForgotPasswordFields) => {
    const result = await authService.forgotPassword(data);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message || 'If your account exists, a reset link has been sent.');
  };

  return (
    <div className="w-full">
      <p className="text-sm text-gray-600 mb-4">
        Enter your email or username and we will send you a password reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email or username" error={errors.identifier?.message} delay={100} xx={true}>
          <Input
            {...register('identifier')}
            type="text"
            placeholder="you@example.com"
            autoComplete="username"
            hasError={!!errors.identifier}
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
          {isSubmitting ? 'Sending link...' : 'Send reset link'}
        </button>
      </form>
    </div>
  );
}
