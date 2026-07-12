'use client';

import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

import { checkoutService } from '@/services/checkout.service';
import type {
  CheckoutCallbackState,
  CheckoutInitializeInput,
  CheckoutInitializationData,
} from '@/services/checkout.service';

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

export class CheckoutServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new CheckoutServiceError(result.message);
  }

  return result.data;
}

type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, CheckoutServiceError, TVariables>,
  'mutationFn'
>;

export function useCheckoutInitializeMutation(
  options?: MutationOptionsOf<CheckoutInitializationData, CheckoutInitializeInput>
) {
  return useMutation({
    mutationFn: async (data: CheckoutInitializeInput) =>
      unwrapResult(await checkoutService.initializeCheckout(data)),
    retry: false,
    ...options,
  });
}

export function useCheckoutCallbackState(
  input: URL | URLSearchParams | string
): CheckoutCallbackState {
  return checkoutService.getCallbackState(input);
}
