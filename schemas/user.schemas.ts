import { z } from 'zod';

export const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),

    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
      .optional(),

    firstName: z
      .string()
      .trim()
      .min(1, 'First name cannot be empty')
      .max(50, 'First name must be at most 50 characters')
      .optional(),
    firstname: z
      .string()
      .trim()
      .min(1, 'First name cannot be empty')
      .max(50, 'First name must be at most 50 characters')
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(1, 'Last name cannot be empty')
      .max(50, 'Last name must be at most 50 characters')
      .optional(),
    lastname: z
      .string()
      .trim()
      .min(1, 'Last name cannot be empty')
      .max(50, 'Last name must be at most 50 characters')
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7, 'Phone number must be at least 7 characters')
      .max(20, 'Phone number must be at most 20 characters')
      .optional(),

    avatar: z.string().trim().url('Avatar must be a valid URL').optional(),

    dateOfBirth: z
      .string()
      .trim()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Date of birth must be a valid date (e.g., YYYY-MM-DD)',
      })
      .refine((val) => new Date(val) <= new Date(), {
        message: 'Date of birth cannot be in the future',
      })
      .optional(),

    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to perform an update',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const upsertAddressSchema = z.object({
  label: z.string().trim().max(30, 'Label must be at most 30 characters').optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(50, 'Last name is too long'),
  phone: z.string().trim().min(7, 'Phone is too short').max(20, 'Phone is too long'),
  street: z.string().trim().min(3, 'Street is required').max(120, 'Street is too long'),
  city: z.string().trim().min(2, 'City is required').max(80, 'City is too long'),
  state: z.string().trim().min(2, 'State is required').max(80, 'State is too long'),
  country: z.string().trim().min(2, 'Country is required').max(80, 'Country is too long'),
  postalCode: z.string().trim().max(20, 'Postal code is too long').optional(),
});

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
