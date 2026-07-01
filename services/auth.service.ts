import http from '@/lib/ky';
import type { UserRole, UserStatus } from '@/models/User';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@/schemas/auth.schemas';
import {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '@/schemas/schema.types';
import { HTTPError } from 'ky';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthResult = {
  success: boolean;
  message: string;
};
type RefreshResult =
  { success: true; role: UserRole } | { success: false; message: string; shouldLogout: boolean };

type LoginUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Default HTTP status → user-facing message map.
 * Methods can supply their own overrides via the `statusOverrides` param.
 */
const DEFAULT_HTTP_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: 'Invalid or expired link. Please request a new one.',
  401: 'Invalid credentials.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'An account with this email already exists.',
  408: 'An account with this username already exists.',
  422: 'Invalid input. Please check your data and try again.',
  423: 'Your account has been suspended. Please contact support.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The request timed out. Please try again.',
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuthService {
  // -- Helpers -----------------------------------------------------------------

  private static ok(message: string): AuthResult {
    return { success: true, message };
  }

  private static fail(message: string): AuthResult {
    return { success: false, message };
  }

  private static fromValidationError(error: z.ZodError): AuthResult {
    const message = error.issues.map((i) => i.message).join(', ');
    return AuthService.fail(message);
  }

  private static fromHttpError(
    error: unknown,
    fallback = 'An unexpected error occurred. Please try again.',
    statusOverrides: Partial<Record<number, string>> = {}
  ): AuthResult {
    if (!(error instanceof HTTPError)) {
      return AuthService.fail(fallback);
    }

    const status = error.response?.status;
    const message = statusOverrides[status] ?? DEFAULT_HTTP_ERROR_MESSAGES[status] ?? fallback;

    return AuthService.fail(message);
  }

  private static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; result: AuthResult } {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return { success: false, result: AuthService.fromValidationError(parsed.error) };
    }
    return { success: true, data: parsed.data };
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await http.post(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return res.json() as Promise<T>;
  }

  // -- Public API --------------------------------------------------------------

  login = async (data: LoginBody): Promise<AuthResult> => {
    const validation = AuthService.validate(loginSchema, data);
    if (!validation.success) return validation.result;
    try {
      const res = await this.post<{ user: LoginUser; message: string }>(
        'auth/login',
        validation.data
      );
      return AuthService.ok(res.message);
    } catch (error) {
      console.log('Error', error);
      return AuthService.fromHttpError(error, 'An error occurred while logging in.');
    }
  };
  async register(data: RegisterBody): Promise<AuthResult> {
    const validation = AuthService.validate(registerSchema, data);
    if (!validation.success) return validation.result;

    try {
      const res = await this.post<{ message: string }>('auth/register', validation.data);
      return AuthService.ok(res.message);
    } catch (error) {
      return AuthService.fromHttpError(error, 'An error occurred while creating your account.');
    }
  }

  async logout(): Promise<AuthResult> {
    try {
      const res = await this.post<{ message: string }>('auth/logout');
      return AuthService.ok(res.message);
    } catch {
      return AuthService.fail('An error occurred while logging out. Please try again.');
    }
  }

  async forgotPassword(data: ForgotPasswordBody): Promise<AuthResult> {
    const validation = AuthService.validate(forgotPasswordSchema, data);
    if (!validation.success) return validation.result;

    try {
      const res = await this.post<{ message: string }>('auth/forgot-password', validation.data);
      return AuthService.ok(res.message);
    } catch (error) {
      return AuthService.fromHttpError(
        error,
        'An error occurred while sending the reset email. Please try again.'
      );
    }
  }

  async resetPassword(data: ResetPasswordBody): Promise<AuthResult> {
    const validation = AuthService.validate(resetPasswordSchema, data);
    if (!validation.success) return validation.result;

    try {
      const res = await this.post<{ message: string }>('auth/reset-password', validation.data);
      return AuthService.ok(res.message);
    } catch (error) {
      return AuthService.fromHttpError(error, 'An error occurred while resetting your password.');
    }
  }

  async verifyEmail(data: VerifyEmailBody): Promise<AuthResult> {
    const validation = AuthService.validate(verifyEmailSchema, data);
    if (!validation.success) return validation.result;

    try {
      const res = await this.post<{ message: string }>('auth/verify-email', validation.data);
      return AuthService.ok(res.message);
    } catch (error) {
      return AuthService.fromHttpError(error, 'An error occurred while verifying your email.', {
        400: 'This verification link is invalid or has expired. Please request a new one.',
        422: 'Invalid verification data. Please check the link or request a new verification email.',
      });
    }
  }
  async refresh(): Promise<RefreshResult> {
    try {
      const res = await this.post<{ data: { role: UserRole } }>('auth/refresh');
      return { success: true, role: res.data.role };
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response?.status;

        // 401 = session gone (expired, invalid, conflict) → force logout
        // 403 = account revoked → force logout
        if (status === 401 || status === 403) {
          const body = await error.response.json().catch(() => ({}));
          return {
            success: false,
            message: body?.message ?? 'Your session has ended. Please sign in again.',
            shouldLogout: true,
          };
        }

        // 5xx or network error → don't log out, retry is reasonable
        return {
          success: false,
          message: 'Network error. Please check your connection.',
          shouldLogout: false,
        };
      }

      return {
        success: false,
        message: 'An unexpected error occurred.',
        shouldLogout: false,
      };
    }
  }
}
