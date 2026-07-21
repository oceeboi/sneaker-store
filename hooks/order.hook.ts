'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { orderService } from '@/services/order.service';
import type {
  AdminOrderDetailData,
  AdminOrderSummaryData,
  GetAdminOrdersParams,
  GetOrdersParams,
  OrderPagination,
  UserOrderDetailData,
  OrderSummaryData,
  UpdateAdminOrderInput,
} from '@/services/order.service';

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

export class OrderServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new OrderServiceError(result.message);
  }

  return result.data;
}

export const orderKeys = {
  all: ['orders'] as const,
  list: (params?: GetOrdersParams) => [...orderKeys.all, 'list', params ?? {}] as const,
  detail: (orderId: string) => [...orderKeys.all, 'detail', orderId] as const,
  detailByOrderNumber: (orderNumber: string) =>
    [...orderKeys.all, 'detail-order-number', orderNumber] as const,
  adminAll: () => [...orderKeys.all, 'admin'] as const,
  adminList: (params?: GetAdminOrdersParams) =>
    [...orderKeys.adminAll(), 'list', params ?? {}] as const,
  adminDetail: (orderId: string) => [...orderKeys.adminAll(), 'detail', orderId] as const,
};

type QueryOptionsOf<TData> = Omit<
  UseQueryOptions<TData, OrderServiceError>,
  'queryKey' | 'queryFn'
>;
type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, OrderServiceError, TVariables>,
  'mutationFn'
>;

export function useOrdersQuery(
  params?: GetOrdersParams,
  options?: QueryOptionsOf<{ orders: OrderSummaryData[]; pagination: OrderPagination }>
) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: async () => unwrapResult(await orderService.getOrders(params)),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useOrderQuery(orderId: string, options?: QueryOptionsOf<OrderSummaryData>) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async () => unwrapResult(await orderService.getOrderById(orderId)),
    enabled: Boolean(orderId),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useOrderByOrderNumberQuery(
  orderNumber: string,
  options?: QueryOptionsOf<UserOrderDetailData>
) {
  return useQuery({
    queryKey: orderKeys.detailByOrderNumber(orderNumber),
    queryFn: async () => unwrapResult(await orderService.getOrderByOrderNumber(orderNumber)),
    enabled: Boolean(orderNumber),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useAdminOrdersQuery(
  params?: GetAdminOrdersParams,
  options?: QueryOptionsOf<{ orders: AdminOrderSummaryData[]; pagination: OrderPagination }>
) {
  return useQuery({
    queryKey: orderKeys.adminList(params),
    queryFn: async () => unwrapResult(await orderService.getAdminOrders(params)),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAdminOrderQuery(
  orderId: string,
  options?: QueryOptionsOf<AdminOrderDetailData>
) {
  return useQuery({
    queryKey: orderKeys.adminDetail(orderId),
    queryFn: async () => unwrapResult(await orderService.getAdminOrderById(orderId)),
    enabled: Boolean(orderId),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useUpdateAdminOrderMutation(
  options?: MutationOptionsOf<
    AdminOrderDetailData | null,
    { orderId: string; data: UpdateAdminOrderInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, data }) =>
      unwrapResult(await orderService.updateAdminOrder(orderId, data)),
    onSuccess: (order, variables, onMutateResult, context) => {
      queryClient.setQueryData(orderKeys.adminDetail(variables.orderId), order);
      queryClient.invalidateQueries({ queryKey: orderKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      options?.onSuccess?.(order, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteAdminOrderMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) =>
      unwrapResult(await orderService.deleteAdminOrder(orderId)),
    onSuccess: (result, orderId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: orderKeys.adminDetail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      options?.onSuccess?.(result, orderId, onMutateResult, context);
    },
    ...options,
  });
}
