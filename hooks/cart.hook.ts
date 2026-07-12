'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { cartService } from '@/services/cart.service';
import type {
  AddCartItemInput,
  CartData,
  CartPagination,
  DeleteCartItemInput,
  GetAdminCartsParams,
  PreviewAbandonedCartsParams,
  SweepAbandonedCartsInput,
  UpdateAdminCartStatusInput,
  UpdateCartItemInput,
} from '@/services/cart.service';

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

export class CartServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new CartServiceError(result.message);
  }

  return result.data;
}

export const cartKeys = {
  all: ['cart'] as const,
  current: () => [...cartKeys.all, 'current'] as const,
  adminAll: () => [...cartKeys.all, 'admin'] as const,
  adminList: (params?: GetAdminCartsParams) =>
    [...cartKeys.adminAll(), 'list', params ?? {}] as const,
  adminDetail: (cartId: string) => [...cartKeys.adminAll(), 'detail', cartId] as const,
  abandonedPreview: (params?: PreviewAbandonedCartsParams) =>
    [...cartKeys.adminAll(), 'abandoned', 'preview', params ?? {}] as const,
};

type QueryOptionsOf<TData> = Omit<UseQueryOptions<TData, CartServiceError>, 'queryKey' | 'queryFn'>;
type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, CartServiceError, TVariables>,
  'mutationFn'
>;

export function useCartQuery(options?: QueryOptionsOf<CartData>) {
  return useQuery({
    queryKey: cartKeys.current(),
    queryFn: async () => unwrapResult(await cartService.getCart()),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useAddCartItemMutation(options?: MutationOptionsOf<CartData, AddCartItemInput>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddCartItemInput) => unwrapResult(await cartService.addItem(data)),
    onSuccess: (cart, variables, onMutateResult, context) => {
      queryClient.setQueryData(cartKeys.current(), cart);
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(cart, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useUpdateCartItemMutation(
  options?: MutationOptionsOf<CartData, UpdateCartItemInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCartItemInput) =>
      unwrapResult(await cartService.updateItem(data)),
    onSuccess: (cart, variables, onMutateResult, context) => {
      queryClient.setQueryData(cartKeys.current(), cart);
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(cart, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteCartItemMutation(
  options?: MutationOptionsOf<CartData, DeleteCartItemInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteCartItemInput) =>
      unwrapResult(await cartService.deleteItem(data)),
    onSuccess: (cart, variables, onMutateResult, context) => {
      queryClient.setQueryData(cartKeys.current(), cart);
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(cart, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useClearCartMutation(options?: MutationOptionsOf<CartData, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrapResult(await cartService.clearCart()),
    onSuccess: (cart, variables, onMutateResult, context) => {
      queryClient.setQueryData(cartKeys.current(), cart);
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(cart, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useAdminCartsQuery(
  params?: GetAdminCartsParams,
  options?: QueryOptionsOf<{ carts: CartData[]; pagination: CartPagination }>
) {
  return useQuery({
    queryKey: cartKeys.adminList(params),
    queryFn: async () => unwrapResult(await cartService.getAdminCarts(params)),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAdminCartQuery(cartId: string, options?: QueryOptionsOf<CartData>) {
  return useQuery({
    queryKey: cartKeys.adminDetail(cartId),
    queryFn: async () => unwrapResult(await cartService.getAdminCartById(cartId)),
    enabled: Boolean(cartId),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useUpdateAdminCartStatusMutation(
  options?: MutationOptionsOf<CartData, { cartId: string; data: UpdateAdminCartStatusInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cartId, data }) =>
      unwrapResult(await cartService.updateAdminCartStatus(cartId, data)),
    onSuccess: (cart, variables, onMutateResult, context) => {
      queryClient.setQueryData(cartKeys.adminDetail(variables.cartId), cart);
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      queryClient.setQueryData(cartKeys.current(), cart);
      options?.onSuccess?.(cart, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteAdminCartMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartId: string) => unwrapResult(await cartService.deleteAdminCart(cartId)),
    onSuccess: (result, cartId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: cartKeys.adminDetail(cartId) });
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(result, cartId, onMutateResult, context);
    },
    ...options,
  });
}

export function usePreviewAbandonedCartsQuery(
  params?: PreviewAbandonedCartsParams,
  options?: QueryOptionsOf<{
    candidateCount: number;
    idleMinutesThreshold: number;
    carts: CartData[];
  }>
) {
  return useQuery({
    queryKey: cartKeys.abandonedPreview(params),
    queryFn: async () => unwrapResult(await cartService.previewAbandonedCarts(params)),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSweepAbandonedCartsMutation(
  options?: MutationOptionsOf<
    {
      dryRun?: boolean;
      candidateCount?: number;
      carts?: CartData[];
      processedCount?: number;
      notified?: number;
      failed?: number;
      results?: import('@/services/cart.service').AdminAbandonedCartSweepResult[];
    },
    SweepAbandonedCartsInput | void
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data?: SweepAbandonedCartsInput) =>
      unwrapResult(await cartService.sweepAbandonedCarts(data ?? {})),
    onSuccess: (result, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.adminAll() });
      options?.onSuccess?.(result, variables, onMutateResult, context);
    },
    ...options,
  });
}
