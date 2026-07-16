import { z } from 'zod';

// ─── Register ─────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
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
    .transform((value) => value.toLocaleUpperCase())
    // .refine((value) => value.length === 0 || /^(?=.{3,30}$)[a-zA-Z0-9_]+$/.test(value), {
    //   message:
    //     'Referral code must be 3-30 characters and contain only letters, numbers, or underscores',
    // })
    .optional()
    .or(z.literal('')),
});

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  // Accepts either email or username in one field
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .trim()
    .refine(
      (v) => (v.includes('@') ? z.string().email().safeParse(v).success : v.length >= 3),
      'Enter a valid email address or username'
    ),

  password: z.string().min(1, 'Password is required'),
});

// ─── Forgot password ──────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .trim()
    .refine(
      (v) => (v.includes('@') ? z.string().email().safeParse(v).success : v.length >= 3),
      'Enter a valid email address or username'
    ),
});

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ─── Verify email ─────────────────────────────────────────────────────────────
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
