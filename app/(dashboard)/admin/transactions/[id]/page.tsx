'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useAdminTransactionQuery,
  useDeleteAdminTransactionMutation,
  useUpdateAdminTransactionMutation,
} from '@/hooks/transaction.hook';
import {
  AdminTransactionData,
  TransactionStatus,
  UpdateAdminTransactionInput,
} from '@/services/transaction.service';
import { format_currency } from '@/utils/format';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

const STATUS_BADGE_VARIANT: Record<
  TransactionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  success: 'secondary',
  failed: 'destructive',
  abandoned: 'destructive',
};

const NEXT_STATUS_OPTIONS: Record<TransactionStatus, UpdateAdminTransactionInput['status'][]> = {
  pending: ['failed', 'abandoned'],
  success: [],
  failed: [],
  abandoned: [],
};

function LinkedOrder({ transaction }: { transaction: AdminTransactionData }) {
  if (!transaction.order) {
    return null;
  }

  return (
    <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Linked order
        </h4>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/orders/${encodeURIComponent(transaction.orderId)}`}>View order</Link>
        </Button>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Order Number</dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">
            {transaction.order.orderNumber}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Order Status</dt>
          <dd className="mt-1 text-sm text-neutral-800 capitalize">
            {transaction.order.status.replaceAll('_', ' ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Order Total</dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-900">
            {format_currency(transaction.order.total)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Order Date</dt>
          <dd className="mt-1 text-sm text-neutral-800">
            {format_date(transaction.order.createdAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function format_date(value: Date | string | null | undefined) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_status(status: TransactionStatus) {
  return status.replaceAll('_', ' ');
}

function format_channel(channel: string | null) {
  if (!channel) return 'Unknown';
  return channel.replaceAll('_', ' ');
}

function format_user_status(status: string | null | undefined) {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ');
}

function UserInfo({ transaction }: { transaction: AdminTransactionData }) {
  const user = transaction.user;

  if (!user) {
    return <p className="text-sm text-neutral-700">Guest checkout</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Name</p>
        <p className="mt-1 text-sm font-medium text-neutral-900">
          {user.username?.trim() || 'Unnamed user'}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Email</p>
        <p className="mt-1 break-all text-sm text-neutral-800">{user.email || 'No email'}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Role</p>
        <p className="mt-1 text-sm capitalize text-neutral-800">{user.role || 'user'}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Account status</p>
        <p className="mt-1 text-sm capitalize text-neutral-800">
          {format_user_status(user.status)}
        </p>
      </div>
    </div>
  );
}

export default function AdminTransactionDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const transaction_id = decodeURIComponent(params?.id ?? '').trim();

  const {
    data: admin_transaction_view_by_id,
    isLoading: is_admin_transaction_loading,
    isFetching: is_admin_transaction_fetching,
    error: admin_error,
  } = useAdminTransactionQuery(transaction_id);

  const {
    mutate: admin_transaction_status_and_reason,
    isPending: is_admin_transaction_update_pending,
  } = useUpdateAdminTransactionMutation();

  const { mutate: delete_transaction, isPending: is_admin_transaction_delete_pending } =
    useDeleteAdminTransactionMutation();

  const [next_status, set_next_status] = useState<UpdateAdminTransactionInput['status'] | ''>('');
  const [update_reason, set_update_reason] = useState('');

  const allowed_next_statuses = useMemo(() => {
    if (!admin_transaction_view_by_id) return [];
    return NEXT_STATUS_OPTIONS[admin_transaction_view_by_id.status];
  }, [admin_transaction_view_by_id]);

  useEffect(() => {
    set_next_status(allowed_next_statuses[0] ?? '');
    set_update_reason('');
  }, [allowed_next_statuses]);

  useEffect(() => {
    if (admin_error?.message) {
      toast.error(admin_error.message);
    }
  }, [admin_error?.message]);

  const can_delete_transaction =
    admin_transaction_view_by_id?.status === 'failed' ||
    admin_transaction_view_by_id?.status === 'abandoned';

  function admin_onDelete() {
    if (!admin_transaction_view_by_id) {
      toast.error('Transaction is unavailable. Refresh and try again.');
      return;
    }

    const is_confirmed = window.confirm(
      'Delete this transaction permanently? This only works for failed or abandoned transactions.'
    );
    if (!is_confirmed) return;

    delete_transaction(admin_transaction_view_by_id.id, {
      onSuccess: () => {
        toast.success('Transaction deleted successfully.');
        router.push('/admin/transactions');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete transaction.');
      },
    });
  }

  function admin_onUpdate() {
    if (!admin_transaction_view_by_id) {
      toast.error('Transaction is unavailable. Refresh and try again.');
      return;
    }

    if (!next_status) {
      toast.error('Choose a new status to continue.');
      return;
    }

    const reason = update_reason.trim();
    if (reason && reason.length < 3) {
      toast.error('Reason must be at least 3 characters when provided.');
      return;
    }

    const payload: { transactionId: string; data: UpdateAdminTransactionInput } = {
      transactionId: admin_transaction_view_by_id.id,
      data: {
        status: next_status,
        ...(reason ? { failureReason: reason } : undefined),
      },
    };

    admin_transaction_status_and_reason(payload, {
      onSuccess: () => {
        toast.success(`Transaction marked as ${format_status(next_status)}.`);
        set_update_reason('');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update transaction status.');
      },
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Transaction details</p>
            <h3 className="break-all text-[24px] font-medium text-[#1d2128]">
              {admin_transaction_view_by_id?.reference ?? transaction_id ?? 'Transaction'}
            </h3>
            <p className="text-sm text-neutral-500">
              Review payment metadata, update transaction outcome, and resolve failed attempts.
            </p>
          </div>

          {admin_transaction_view_by_id ? (
            <div className="grid gap-1 text-left sm:text-right">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Transaction ID</p>
              <p className="break-all text-xs text-neutral-700">
                {admin_transaction_view_by_id.id}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center mb-5 gap-2">
          {admin_transaction_view_by_id ? (
            <Badge
              variant={STATUS_BADGE_VARIANT[admin_transaction_view_by_id.status]}
              className="capitalize"
            >
              {format_status(admin_transaction_view_by_id.status)}
            </Badge>
          ) : null}

          {admin_transaction_view_by_id?.verifiedAt ? (
            <Badge variant="secondary">Verified</Badge>
          ) : (
            <Badge variant="outline">Not verified</Badge>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href="/admin/transactions">Back to transactions</Link>
          </Button>
        </div>

        {is_admin_transaction_fetching && !is_admin_transaction_loading ? (
          <p className="mt-3 text-xs text-neutral-500">Refreshing transaction data...</p>
        ) : null}

        {is_admin_transaction_loading ? (
          <div className="grid gap-4">
            <div className="h-20 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-52 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
          </div>
        ) : null}

        {!is_admin_transaction_loading && admin_error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {admin_error.message}
          </div>
        ) : null}

        {!is_admin_transaction_loading && !admin_transaction_view_by_id && !admin_error ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">Transaction not found</h4>
            <p className="mt-2 text-sm text-neutral-500">
              We could not find this transaction in the system.
            </p>
          </div>
        ) : null}

        {admin_transaction_view_by_id ? (
          <div className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Admin actions
              </h4>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                    Next status
                  </label>
                  <select
                    value={next_status}
                    onChange={(event) =>
                      set_next_status(
                        event.target.value as UpdateAdminTransactionInput['status'] | ''
                      )
                    }
                    disabled={
                      allowed_next_statuses.length === 0 || is_admin_transaction_update_pending
                    }
                    className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {allowed_next_statuses.length === 0 ? (
                      <option value="">No further transitions</option>
                    ) : null}
                    {allowed_next_statuses.map((status) => (
                      <option key={status} value={status}>
                        {format_status(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                    Reason (optional)
                  </label>
                  <textarea
                    value={update_reason}
                    onChange={(event) => set_update_reason(event.target.value)}
                    placeholder="Add note for this transaction update"
                    rows={3}
                    className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30"
                  />
                </div>

                <div className="flex flex-col items-end gap-2 lg:items-stretch lg:justify-end">
                  <Button
                    onClick={admin_onUpdate}
                    disabled={!next_status || is_admin_transaction_update_pending}
                    className="w-full"
                  >
                    {is_admin_transaction_update_pending ? 'Updating...' : 'Update status'}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={admin_onDelete}
                    disabled={!can_delete_transaction || is_admin_transaction_delete_pending}
                    className="w-full"
                  >
                    {is_admin_transaction_delete_pending ? 'Deleting...' : 'Delete transaction'}
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-xs text-neutral-500">
                Only pending transactions can be changed, and only failed or abandoned transactions
                can be deleted.
              </p>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                User info
              </h4>
              <UserInfo transaction={admin_transaction_view_by_id} />
            </section>

            <section>
              <LinkedOrder transaction={admin_transaction_view_by_id} />
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Summary
              </h4>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
                  <dd className="mt-1 text-base font-semibold text-neutral-900">
                    {format_currency(admin_transaction_view_by_id.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Currency</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {admin_transaction_view_by_id.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Channel</dt>
                  <dd className="mt-1 text-sm capitalize text-neutral-800">
                    {format_channel(admin_transaction_view_by_id.channel)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Created</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_transaction_view_by_id.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Paid At</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_transaction_view_by_id.paidAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Verified At</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_transaction_view_by_id.verifiedAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">
                    Transaction reference
                  </dt>
                  <dd className="mt-1 break-all text-sm text-neutral-800">
                    {admin_transaction_view_by_id.reference}
                  </dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">
                    Paystack reference
                  </dt>
                  <dd className="mt-1 break-all text-sm text-neutral-800">
                    {admin_transaction_view_by_id.paystackReference || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Order ID</dt>
                  <dd className="mt-1 break-all text-sm text-neutral-800">
                    {admin_transaction_view_by_id.orderId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Last updated</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_transaction_view_by_id.updatedAt)}
                  </dd>
                </div>
                {admin_transaction_view_by_id.failureReason ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Failure reason
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {admin_transaction_view_by_id.failureReason}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {admin_transaction_view_by_id.authorizationUrl ? (
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={admin_transaction_view_by_id.authorizationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open payment authorization
                    </a>
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}
