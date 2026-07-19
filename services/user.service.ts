import http from '@/lib/ky';
import type { UpdateUserInput, PasswordChangeInput } from '@/schemas/user.schemas';
import { updateUserSchema, passwordChangeSchema } from '@/schemas/user.schemas';
import { HTTPError } from 'ky';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  referralId: string | null;
  accountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserData = {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile: UserProfile | null;
};

export type ReferralData = {
  userId: string;
  referralCode: string;
  successfulReferrals: number;
  pendingReferrals: number;
  pointsEarned: number;
  pointsAvailable: number;
  pointsRedeemed: number;
  totalRewards: number;
  isActive: boolean;
  lastRewardAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountData = {
  userId: string;
  tier: string;
  membershipStatus: string;
  membershipStartedAt: Date | null;
  membershipEndsAt: Date | null;
  storeCredit: number;
  totalSpent: number;
  loyaltyPoints: number;
  perksEnabled: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AddressData = {
  id: string;
  type: 'billing' | 'shipping' | 'both';
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_HTTP_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: 'Bad request. Please check your data.',
  401: 'Unauthorized. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This resource already exists.',
  422: 'Invalid input. Please check your data and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The request timed out. Please try again.',
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class UserService {
  // -- Helpers -----------------------------------------------------------------

  private static fromValidationError(error: z.ZodError): string {
    return error.issues.map((i) => i.message).join(', ');
  }

  private static fromHttpError(
    error: unknown,
    fallback = 'An unexpected error occurred. Please try again.',
    statusOverrides: Partial<Record<number, string>> = {}
  ): string {
    if (!(error instanceof HTTPError)) {
      return fallback;
    }

    const status = error.response?.status;
    return statusOverrides[status] ?? DEFAULT_HTTP_ERROR_MESSAGES[status] ?? fallback;
  }

  private static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; message: string } {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return { success: false, message: UserService.fromValidationError(parsed.error) };
    }
    return { success: true, data: parsed.data };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await http.get(path, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    return res.json() as Promise<T>;
  }

  private async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await http.patch(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await http.post(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return res.json() as Promise<T>;
  }

  // -- Public API: User Data ---------------------------------------------------

  async getUser(): Promise<ServiceResult<UserData>> {
    try {
      const res = await this.get<{ data: { user: UserData } }>('user');
      return { success: true, data: res.data.user };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch user data.'),
      };
    }
  }

  async updateUser(data: UpdateUserInput): Promise<ServiceResult<UserData>> {
    const validation = UserService.validate(updateUserSchema, data);
    if (!validation.success) return validation;

    try {
      const res = await this.patch<{ data: { user: UserData } }>('user/update', validation.data);
      return { success: true, data: res.data.user };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to update user.', {
          409: 'An account with this email or username already exists.',
          404: 'User or profile not found.',
        }),
      };
    }
  }

  async changePassword(data: PasswordChangeInput): Promise<ServiceResult<{ message: string }>> {
    const validation = UserService.validate(passwordChangeSchema, data);
    if (!validation.success) return validation;

    try {
      const res = await this.post<{ data: { message: string } }>(
        'user/password-change',
        validation.data
      );
      return { success: true, data: { message: res.data.message } };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to change password.', {
          401: 'Current password is incorrect.',
        }),
      };
    }
  }

  // -- Public API: Rewards / Referrals -----------------------------------------

  async getReferral(): Promise<ServiceResult<ReferralData>> {
    try {
      const res = await this.get<{ data: { referral: ReferralData } }>('user/rewards');
      return { success: true, data: res.data.referral };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch referral data.', {
          404: 'Referral record not found.',
        }),
      };
    }
  }

  // -- Public API: Membership / Account ----------------------------------------

  async getAccount(): Promise<ServiceResult<AccountData>> {
    try {
      const res = await this.get<{ data: { account: AccountData } }>('user/membership');
      return { success: true, data: res.data.account };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch account data.', {
          404: 'Account record not found.',
        }),
      };
    }
  }

  // -- Public API: Addresses ---------------------------------------------------

  async getAddresses(): Promise<
    ServiceResult<{
      addresses: AddressData[];
      defaults: { billing: AddressData | null; shipping: AddressData | null };
    }>
  > {
    try {
      const res = await this.get<{
        data: {
          addresses: AddressData[];
          defaults: { billing: AddressData | null; shipping: AddressData | null };
        };
      }>('user/address');
      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch addresses.'),
      };
    }
  }

  async getBillingAddress(): Promise<ServiceResult<AddressData>> {
    try {
      const res = await this.get<{ data: { address: AddressData } }>('user/address/billing');
      return { success: true, data: res.data.address };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch billing address.', {
          404: 'Billing address not found.',
        }),
      };
    }
  }

  async updateBillingAddress(data: Record<string, unknown>): Promise<ServiceResult<AddressData>> {
    try {
      const res = await this.patch<{ data: { address: AddressData } }>(
        'user/address/billing',
        data
      );
      return { success: true, data: res.data.address };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to update billing address.'),
      };
    }
  }

  async getShippingAddress(): Promise<ServiceResult<AddressData>> {
    try {
      const res = await this.get<{ data: { address: AddressData } }>('user/address/shipping');
      return { success: true, data: res.data.address };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to fetch shipping address.', {
          404: 'Shipping address not found.',
        }),
      };
    }
  }

  async updateShippingAddress(data: Record<string, unknown>): Promise<ServiceResult<AddressData>> {
    try {
      const res = await this.patch<{ data: { address: AddressData } }>(
        'user/address/shipping',
        data
      );
      return { success: true, data: res.data.address };
    } catch (error) {
      return {
        success: false,
        message: UserService.fromHttpError(error, 'Failed to update shipping address.'),
      };
    }
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────────

export const userService = new UserService();
