'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrdersQuery } from '@/hooks/order.hook';
import { useTransactionsQuery } from '@/hooks/transaction.hook';
import { useUserQuery } from '@/hooks/user.hook';
import { OrderStatus, OrderSummaryData } from '@/services/order.service';
import { TransactionData, TransactionStatus } from '@/services/transaction.service';
import { format_currency } from '@/utils/format';

const ORDER_STATUS_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending_payment: 'outline',
  paid: 'secondary',
  processing: 'secondary',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'destructive',
};

const TRANSACTION_STATUS_VARIANT: Record<
  TransactionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  success: 'secondary',
  failed: 'destructive',
  abandoned: 'destructive',
};

function format_date(value: Date | string | null | undefined) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_status(value: string) {
  return value.replaceAll('_', ' ');
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
    >
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        <p className="text-sm leading-6 text-neutral-500">{description}</p>
      </div>
    </Link>
  );
}

function OrderPreview({ order }: { order: OrderSummaryData }) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Order</p>
          <p className="text-sm font-semibold text-neutral-900">{order.orderNumber}</p>
        </div>
        <Badge variant={ORDER_STATUS_VARIANT[order.status]} className="capitalize">
          {format_status(order.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Placed</dt>
          <dd className="mt-1 text-neutral-700">{format_date(order.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Total</dt>
          <dd className="mt-1 font-semibold text-neutral-900">{format_currency(order.total)}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/orders/${encodeURIComponent(order.orderNumber)}`}>View order</Link>
        </Button>
      </div>
    </article>
  );
}

function TransactionPreview({ transaction }: { transaction: TransactionData }) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Transaction</p>
          <p className="break-all text-sm font-semibold text-neutral-900">
            {transaction.reference}
          </p>
        </div>
        <Badge variant={TRANSACTION_STATUS_VARIANT[transaction.status]} className="capitalize">
          {format_status(transaction.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Date</dt>
          <dd className="mt-1 text-neutral-700">{format_date(transaction.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
          <dd className="mt-1 font-semibold text-neutral-900">
            {format_currency(transaction.amount)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/transactions/${encodeURIComponent(transaction.reference)}`}>
            View transaction
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { data: user_info, isLoading: is_user_loading } = useUserQuery();
  const { data: orders, isLoading: is_orders_loading } = useOrdersQuery({ limit: 3 });
  const { data: transactions, isLoading: is_transactions_loading } = useTransactionsQuery({
    limit: 3,
  });

  const recent_orders = orders?.orders ?? [];
  const recent_transactions = transactions?.transactions ?? [];

  const display_name =
    user_info?.profile?.firstName || user_info?.username || user_info?.email || 'there';

  const total_orders = orders?.pagination.total ?? 0;
  const total_transactions = transactions?.pagination.total ?? 0;
  const latest_order = recent_orders[0];
  const latest_transaction = recent_transactions[0];

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Account overview</p>
            <h3 className="text-[24px] font-medium text-[#1d2128]">Welcome back, {display_name}</h3>
            <p className="max-w-2xl text-sm text-neutral-500">
              This is your account home. Use it to check recent orders, payment activity, and jump
              back into the areas you use most.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">Edit profile</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders">View orders</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/transactions">View transactions</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Profile</p>
            <p className="mt-2 text-lg font-semibold text-neutral-900">
              {is_user_loading
                ? 'Loading...'
                : (user_info?.username ?? user_info?.email ?? 'Account')}
            </p>
            <p className="mt-1 text-sm text-neutral-500">Your public account identity.</p>
          </div>

          <div className="rounded border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Orders</p>
            <p className="mt-2 text-lg font-semibold text-neutral-900">{total_orders}</p>
            <p className="mt-1 text-sm text-neutral-500">Total orders in your account.</p>
          </div>

          <div className="rounded border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Transactions</p>
            <p className="mt-2 text-lg font-semibold text-neutral-900">{total_transactions}</p>
            <p className="mt-1 text-sm text-neutral-500">Payment records tied to your orders.</p>
          </div>

          <div className="rounded border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Last activity</p>
            <p className="mt-2 text-lg font-semibold text-neutral-900">
              {latest_transaction ? format_status(latest_transaction.status) : 'No activity yet'}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {latest_transaction
                ? format_date(latest_transaction.createdAt)
                : 'Make your first purchase'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <QuickAction
            href="/profile"
            title="Update profile"
            description="Edit your personal details, avatar, and sign-in information."
          />
          <QuickAction
            href="/orders"
            title="Track orders"
            description="Open your latest purchases and follow status updates."
          />
          <QuickAction
            href="/transactions"
            title="Review payments"
            description="Check the payment attempts and verification history."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-medium text-[#1d2128]">Recent orders</h4>
              <p className="text-sm text-neutral-500">
                The last few orders placed on your account.
              </p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link href="/orders">See all</Link>
            </Button>
          </div>

          {is_orders_loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`order-skeleton-${index}`}
                  className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100"
                />
              ))}
            </div>
          ) : recent_orders.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-center">
              <p className="text-sm text-neutral-500">No recent orders yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
              {recent_orders.map((order) => (
                <OrderPreview key={order.id} order={order} />
              ))}
            </div>
          )}

          {latest_order ? (
            <p className="mt-4 text-sm text-neutral-500">
              Latest order:{' '}
              <span className="font-medium text-neutral-900">{latest_order.orderNumber}</span>
            </p>
          ) : null}
        </section>

        <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-medium text-[#1d2128]">Recent transactions</h4>
              <p className="text-sm text-neutral-500">
                Recent payment attempts and verification states.
              </p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link href="/transactions">See all</Link>
            </Button>
          </div>

          {is_transactions_loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`transaction-skeleton-${index}`}
                  className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100"
                />
              ))}
            </div>
          ) : recent_transactions.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-center">
              <p className="text-sm text-neutral-500">No recent transactions yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
              {recent_transactions.map((transaction) => (
                <TransactionPreview key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}

          {latest_transaction ? (
            <p className="mt-4 text-sm text-neutral-500">
              Latest transaction:{' '}
              <span className="break-all font-medium text-neutral-900">
                {latest_transaction.reference}
              </span>
            </p>
          ) : null}
        </section>
      </section>
    </section>
  );
}
