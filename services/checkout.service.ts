import http from '@/lib/ky';
import { HTTPError } from 'ky';
import { z } from 'zod';

export type CheckoutInitializeInput = {
  shippingAddressId: string;
  useStoreCredit?: boolean;
};

export type CheckoutOrderSnapshot = {
  id: string;
  orderNumber: string;
  status: 'pending_payment' | 'paid';
  total?: number;
};

export type CheckoutInitializationData = {
  order: CheckoutOrderSnapshot;
  reference?: string;
  authorizationUrl?: string;
  resumed?: boolean;
  paidWithCredit?: boolean;
  recoveredFromPreviousAttempt?: boolean;
};

export type CheckoutCallbackState = {
  reference: string | null;
  paymentStatus: string | null;
};

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_HTTP_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: 'Bad request. Please check your data.',
  401: 'Unauthorized. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with the current resource state.',
  422: 'Invalid input. Please check your data and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The request timed out. Please try again.',
};

const initialize_checkout_schema = z.object({
  shippingAddressId: z.string().trim().min(1, 'Shipping address id is required.'),
  useStoreCredit: z.boolean().optional(),
});

export class CheckoutService {
  private static fromValidationError(error: z.ZodError): string {
    return error.issues.map((issue) => issue.message).join(', ');
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
      return { success: false, message: CheckoutService.fromValidationError(parsed.error) };
    }

    return { success: true, data: parsed.data };
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.post(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  async initializeCheckout(
    data: CheckoutInitializeInput
  ): Promise<ServiceResult<CheckoutInitializationData>> {
    const validation = CheckoutService.validate(initialize_checkout_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: CheckoutInitializationData }>(
        'checkout/initialize',
        validation.data
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CheckoutService.fromHttpError(error, 'Failed to initialize checkout.', {
          404: 'Shipping address or account context was not found.',
          409: 'Checkout is already in progress or cart stock changed.',
          502: 'Payment gateway initialization failed. Please try again.',
          503: 'Checkout is temporarily unavailable.',
        }),
      };
    }
  }

  getCallbackState(input: URL | URLSearchParams | string): CheckoutCallbackState {
    const searchParams =
      input instanceof URL
        ? input.searchParams
        : input instanceof URLSearchParams
          ? input
          : new URL(input, 'http://localhost').searchParams;

    return {
      reference: searchParams.get('reference'),
      paymentStatus: searchParams.get('paymentStatus'),
    };
  }
}

export const checkoutService = new CheckoutService();
