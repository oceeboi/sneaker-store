import http from '@/lib/ky';
import { HTTPError } from 'ky';
import { z } from 'zod';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export type TransactionData = {
  id: string;
  orderId: string;
  userId?: string;
  reference: string;
  paystackReference: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  channel: string | null;
  authorizationUrl: string | null;
  paidAt: Date | null;
  verifiedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionListUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  role?: string | null;
  status?: string | null;
};

export type AdminTransactionData = TransactionData & {
  user: TransactionListUser;
  order?: TransactionLinkedOrder;
};

export type TransactionOrderItem = {
  productId: string;
  productName: string;
  sizeId: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type TransactionOrderShippingAddress = {
  addressId: string | null;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
};

export type TransactionLinkedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  items: TransactionOrderItem[];
  shippingAddress: TransactionOrderShippingAddress;
};

export type TransactionDetailData = TransactionData & {
  order: TransactionLinkedOrder | null;
};

export type TransactionPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type GetTransactionsParams = {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  reference?: string;
  from?: Date | string;
  to?: Date | string;
};

export type GetAdminTransactionsParams = GetTransactionsParams & {
  userId?: string;
  orderId?: string;
};

export type UpdateAdminTransactionInput = {
  status: 'failed' | 'abandoned';
  failureReason?: string;
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

const update_admin_transaction_schema = z.object({
  status: z.enum(['failed', 'abandoned']),
  failureReason: z.string().trim().min(3).max(300).optional(),
});

export class TransactionService {
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
      return { success: false, message: TransactionService.fromValidationError(parsed.error) };
    }

    return { success: true, data: parsed.data };
  }

  private buildQuery(
    params?: Record<string, string | number | boolean | null | undefined>
  ): string {
    if (!params) return '';

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      searchParams.set(key, String(value));
    }

    const serialized = searchParams.toString();
    return serialized ? `?${serialized}` : '';
  }

  private normalizeQueryDates<T extends { from?: Date | string; to?: Date | string }>(params?: T) {
    if (!params) return undefined;

    return {
      ...params,
      from: params.from instanceof Date ? params.from.toISOString() : params.from,
      to: params.to instanceof Date ? params.to.toISOString() : params.to,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await http.get(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  private async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.patch(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const response = await http.delete(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  async getTransactions(
    params?: GetTransactionsParams
  ): Promise<
    ServiceResult<{ transactions: TransactionData[]; pagination: TransactionPagination }>
  > {
    try {
      const query = this.buildQuery(this.normalizeQueryDates(params));
      const response = await this.get<{
        data: {
          transactions: TransactionData[];
          pagination: TransactionPagination;
        };
      }>(`transactions${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to fetch transactions.'),
      };
    }
  }

  async getTransactionById(transactionId: string): Promise<ServiceResult<TransactionData>> {
    const normalizedTransactionId = transactionId.trim();
    if (!normalizedTransactionId) {
      return { success: false, message: 'Transaction id is required.' };
    }

    try {
      const query = this.buildQuery({ id: normalizedTransactionId });
      const response = await this.get<{ data: { transaction: TransactionData } }>(
        `transactions${query}`
      );

      return { success: true, data: response.data.transaction };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to fetch transaction.', {
          404: 'Transaction not found.',
        }),
      };
    }
  }

  async getTransactionByReference(
    reference: string
  ): Promise<ServiceResult<TransactionDetailData>> {
    const normalized_reference = reference.trim();
    if (!normalized_reference) {
      return { success: false, message: 'Transaction reference is required.' };
    }

    try {
      const response = await this.get<{ data: { transaction: TransactionDetailData } }>(
        `transactions/${encodeURIComponent(normalized_reference)}`
      );

      return { success: true, data: response.data.transaction };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to fetch transaction details.', {
          404: 'Transaction not found.',
        }),
      };
    }
  }

  async getAdminTransactions(
    params?: GetAdminTransactionsParams
  ): Promise<
    ServiceResult<{ transactions: AdminTransactionData[]; pagination: TransactionPagination }>
  > {
    try {
      const query = this.buildQuery(this.normalizeQueryDates(params));
      const response = await this.get<{
        data: {
          transactions: AdminTransactionData[];
          pagination: TransactionPagination;
        };
      }>(`admin/transactions${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to fetch admin transactions.'),
      };
    }
  }

  async getAdminTransactionById(
    transactionId: string
  ): Promise<ServiceResult<AdminTransactionData>> {
    const normalizedTransactionId = transactionId.trim();
    if (!normalizedTransactionId) {
      return { success: false, message: 'Transaction id is required.' };
    }

    try {
      const response = await this.get<{ data: { transaction: AdminTransactionData } }>(
        `admin/transactions/${encodeURIComponent(normalizedTransactionId)}`
      );

      return { success: true, data: response.data.transaction };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to fetch admin transaction.', {
          404: 'Transaction not found.',
        }),
      };
    }
  }

  async updateAdminTransaction(
    transactionId: string,
    data: UpdateAdminTransactionInput
  ): Promise<ServiceResult<TransactionData | null>> {
    const normalizedTransactionId = transactionId.trim();
    if (!normalizedTransactionId) {
      return { success: false, message: 'Transaction id is required.' };
    }

    const validation = TransactionService.validate(update_admin_transaction_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { transaction: TransactionData | null } }>(
        `admin/transactions/${encodeURIComponent(normalizedTransactionId)}`,
        validation.data
      );

      return { success: true, data: response.data.transaction };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to update admin transaction.', {
          404: 'Transaction or linked order not found.',
          409: 'Only pending transactions can be updated manually.',
        }),
      };
    }
  }

  async deleteAdminTransaction(
    transactionId: string
  ): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalizedTransactionId = transactionId.trim();
    if (!normalizedTransactionId) {
      return { success: false, message: 'Transaction id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/transactions/${encodeURIComponent(normalizedTransactionId)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: TransactionService.fromHttpError(error, 'Failed to delete admin transaction.', {
          404: 'Transaction not found.',
          409: 'Only failed or abandoned transactions can be deleted.',
        }),
      };
    }
  }
}

export const transactionService = new TransactionService();
