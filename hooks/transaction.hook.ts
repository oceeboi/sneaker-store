'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { transactionService } from '@/services/transaction.service';
import type {
  GetAdminTransactionsParams,
  TransactionDetailData,
  GetTransactionsParams,
  TransactionData,
  TransactionPagination,
  UpdateAdminTransactionInput,
  AdminTransactionData,
} from '@/services/transaction.service';

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

export class TransactionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new TransactionServiceError(result.message);
  }

  return result.data;
}

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params?: GetTransactionsParams) => [...transactionKeys.all, 'list', params ?? {}] as const,
  detail: (transactionId: string) => [...transactionKeys.all, 'detail', transactionId] as const,
  detailByReference: (reference: string) =>
    [...transactionKeys.all, 'detail-reference', reference] as const,
  adminAll: () => [...transactionKeys.all, 'admin'] as const,
  adminList: (params?: GetAdminTransactionsParams) =>
    [...transactionKeys.adminAll(), 'list', params ?? {}] as const,
  adminDetail: (transactionId: string) =>
    [...transactionKeys.adminAll(), 'detail', transactionId] as const,
};

type QueryOptionsOf<TData> = Omit<
  UseQueryOptions<TData, TransactionServiceError>,
  'queryKey' | 'queryFn'
>;
type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, TransactionServiceError, TVariables>,
  'mutationFn'
>;

export function useTransactionsQuery(
  params?: GetTransactionsParams,
  options?: QueryOptionsOf<{ transactions: TransactionData[]; pagination: TransactionPagination }>
) {
  return useQuery({
    queryKey: transactionKeys.list(params),
    queryFn: async () => unwrapResult(await transactionService.getTransactions(params)),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useTransactionQuery(
  transactionId: string,
  options?: QueryOptionsOf<TransactionData>
) {
  return useQuery({
    queryKey: transactionKeys.detail(transactionId),
    queryFn: async () => unwrapResult(await transactionService.getTransactionById(transactionId)),
    enabled: Boolean(transactionId),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useTransactionByReferenceQuery(
  reference: string,
  options?: QueryOptionsOf<TransactionDetailData>
) {
  return useQuery({
    queryKey: transactionKeys.detailByReference(reference),
    queryFn: async () =>
      unwrapResult(await transactionService.getTransactionByReference(reference)),
    enabled: Boolean(reference),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useAdminTransactionsQuery(
  params?: GetAdminTransactionsParams,
  options?: QueryOptionsOf<{
    transactions: AdminTransactionData[];
    pagination: TransactionPagination;
  }>
) {
  return useQuery({
    queryKey: transactionKeys.adminList(params),
    queryFn: async () => unwrapResult(await transactionService.getAdminTransactions(params)),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAdminTransactionQuery(
  transactionId: string,
  options?: QueryOptionsOf<AdminTransactionData>
) {
  return useQuery({
    queryKey: transactionKeys.adminDetail(transactionId),
    queryFn: async () =>
      unwrapResult(await transactionService.getAdminTransactionById(transactionId)),
    enabled: Boolean(transactionId),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

export function useUpdateAdminTransactionMutation(
  options?: MutationOptionsOf<
    TransactionData | null,
    { transactionId: string; data: UpdateAdminTransactionInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, data }) =>
      unwrapResult(await transactionService.updateAdminTransaction(transactionId, data)),
    onSuccess: (transaction, variables, onMutateResult, context) => {
      queryClient.setQueryData(transactionKeys.adminDetail(variables.transactionId), transaction);
      queryClient.invalidateQueries({ queryKey: transactionKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      options?.onSuccess?.(transaction, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteAdminTransactionMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) =>
      unwrapResult(await transactionService.deleteAdminTransaction(transactionId)),
    onSuccess: (result, transactionId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: transactionKeys.adminDetail(transactionId) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      options?.onSuccess?.(result, transactionId, onMutateResult, context);
    },
    ...options,
  });
}
