'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransactionByReferenceQuery } from '@/hooks/transaction.hook';
import {
  TransactionDetailData,
  TransactionOrderItem,
  TransactionStatus,
} from '@/services/transaction.service';
import { format_currency } from '@/utils/format';

const STATUS_BADGE_VARIANT: Record<
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

function OrderItemsDesktop({ items }: { items: TransactionOrderItem[] }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-180">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              SKU
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Qty
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-neutral-500">
              Unit Price
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-neutral-500">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.productId}-${item.sizeId}-${item.sku}`}
              className="border-b border-neutral-100"
            >
              <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.productName}</td>
              <td className="px-4 py-3 text-sm text-neutral-600">{item.sku}</td>
              <td className="px-4 py-3 text-sm text-neutral-700">{item.size}</td>
              <td className="px-4 py-3 text-sm text-neutral-700">{item.quantity}</td>
              <td className="px-4 py-3 text-right text-sm text-neutral-700">
                {format_currency(item.unitPrice)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">
                {format_currency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderItemsMobile({ items }: { items: TransactionOrderItem[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {items.map((item) => (
        <article
          key={`${item.productId}-${item.sizeId}-${item.sku}`}
          className="rounded border border-neutral-200 bg-white p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h4 className="text-sm font-semibold text-neutral-900">{item.productName}</h4>
            <p className="text-xs text-neutral-500">x{item.quantity}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">SKU</dt>
              <dd className="mt-1 text-neutral-700">{item.sku}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Size</dt>
              <dd className="mt-1 text-neutral-700">{item.size}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Unit Price</dt>
              <dd className="mt-1 text-neutral-700">{format_currency(item.unitPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Subtotal</dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {format_currency(item.subtotal)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function LinkedOrder({ transaction }: { transaction: TransactionDetailData }) {
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
          <Link href={`/orders/${encodeURIComponent(transaction.order.orderNumber)}`}>
            View order
          </Link>
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

export default function TransactionDetailsPage() {
  const params = useParams<{ id: string }>();
  const transaction_reference = decodeURIComponent(params?.id ?? '').trim();

  const {
    data: transaction,
    isLoading: is_transaction_loading,
    error,
  } = useTransactionByReferenceQuery(transaction_reference);

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Transaction details</p>
            <h3 className="break-all text-[24px] font-medium text-[#1d2128]">
              {transaction?.reference ?? transaction_reference ?? 'Transaction'}
            </h3>
            <p className="text-sm text-neutral-500">
              View payment status, gateway references, and linked order details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {transaction ? (
              <Badge variant={STATUS_BADGE_VARIANT[transaction.status]} className="capitalize">
                {transaction.status}
              </Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/transactions">Back to transactions</Link>
            </Button>
          </div>
        </div>

        {is_transaction_loading ? (
          <div className="grid gap-4">
            <div className="h-20 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-24 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-48 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
          </div>
        ) : null}

        {!is_transaction_loading && error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {!is_transaction_loading && !transaction && !error ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">Transaction not found</h4>
            <p className="mt-2 text-sm text-neutral-500">
              We could not find this transaction in your account.
            </p>
          </div>
        ) : null}

        {transaction ? (
          <div className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Summary
              </h4>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
                  <dd className="mt-1 text-base font-semibold text-neutral-900">
                    {format_currency(transaction.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Created</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(transaction.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Paid At</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(transaction.paidAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Verified At</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(transaction.verifiedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Channel</dt>
                  <dd className="mt-1 text-sm text-neutral-800">{transaction.channel ?? '-'}</dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">
                    Paystack Reference
                  </dt>
                  <dd className="mt-1 break-all text-sm text-neutral-800">
                    {transaction.paystackReference ?? '-'}
                  </dd>
                </div>
                {transaction.failureReason ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Failure reason
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">{transaction.failureReason}</dd>
                  </div>
                ) : null}
              </dl>

              {transaction.authorizationUrl ? (
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <a href={transaction.authorizationUrl} target="_blank" rel="noreferrer">
                      Continue payment
                    </a>
                  </Button>
                </div>
              ) : null}
            </section>

            <LinkedOrder transaction={transaction} />

            {transaction.order && transaction.order.items.length > 0 ? (
              <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                  Ordered items
                </h4>
                <OrderItemsMobile items={transaction.order.items} />
                <OrderItemsDesktop items={transaction.order.items} />
              </section>
            ) : null}

            {transaction.order ? (
              <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                  Shipping address
                </h4>
                <div className="text-sm leading-6 text-neutral-800">
                  <p className="font-medium text-neutral-900">
                    {transaction.order.shippingAddress.firstName}{' '}
                    {transaction.order.shippingAddress.lastName}
                  </p>
                  <p>{transaction.order.shippingAddress.phone}</p>
                  <p>{transaction.order.shippingAddress.street}</p>
                  <p>
                    {transaction.order.shippingAddress.city},{' '}
                    {transaction.order.shippingAddress.state}
                  </p>
                  <p>{transaction.order.shippingAddress.country}</p>
                  {transaction.order.shippingAddress.postalCode ? (
                    <p>{transaction.order.shippingAddress.postalCode}</p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}
