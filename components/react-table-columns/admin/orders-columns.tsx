import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminOrderSummaryData, OrderStatus } from '@/services/order.service';
import { format_currency } from '@/utils/format';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';

const column_helper = createColumnHelper<AdminOrderSummaryData>();
const STATUS_BADGE_VARIANT: Record<
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

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function formatStatus(status: OrderStatus) {
  return status.replaceAll('_', ' ');
}

function formatUserStatus(status: string | null | undefined) {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ');
}

function formatTransactionId(transactionId: string | null) {
  if (!transactionId) return 'Not captured';
  if (transactionId.length <= 12) return transactionId;
  return `${transactionId.slice(0, 6)}...${transactionId.slice(-4)}`;
}

export const admin_order_columns = [
  column_helper.display({
    id: 'customer',
    header: () => (
      <span className="text-xs uppercase tracking-wide text-neutral-500">Customer</span>
    ),
    cell: (props) => {
      const user = props.row.original.user;

      if (!user) {
        return <span className="text-sm text-neutral-500">Guest checkout</span>;
      }

      return (
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {user.username?.trim() || user.email?.trim() || 'Unnamed user'}
          </p>
          <p className="truncate text-xs text-neutral-500">{user.email || 'No email provided'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[11px] capitalize">
              {user.role || 'user'}
            </Badge>
            <span className="text-xs text-neutral-500 capitalize">
              {formatUserStatus(user.status)}
            </span>
          </div>
        </div>
      );
    },
  }),
  column_helper.accessor('orderNumber', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Order</span>,
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-neutral-900">{props.getValue()}</p>
          <p className="truncate text-xs text-neutral-500">
            TX: {formatTransactionId(row.transactionId)}
          </p>
        </div>
      );
    },
  }),
  column_helper.accessor('createdAt', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Placed</span>,
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="space-y-1">
          <p className="text-sm text-neutral-700">{formatDate(props.getValue())}</p>
          <p className="text-xs text-neutral-500">Updated: {formatDate(row.updatedAt)}</p>
        </div>
      );
    },
  }),
  column_helper.accessor('status', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Status</span>,
    cell: (props) => {
      const status = props.getValue();
      const row = props.row.original;

      return (
        <div className="space-y-1">
          <Badge variant={STATUS_BADGE_VARIANT[status]} className="capitalize">
            {formatStatus(status)}
          </Badge>
          {row.cancelReason ? (
            <p className="max-w-[18ch] truncate text-xs text-red-600" title={row.cancelReason}>
              Reason: {row.cancelReason}
            </p>
          ) : null}
        </div>
      );
    },
  }),
  column_helper.accessor('total', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Total</span>,
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-neutral-900">{format_currency(props.getValue())}</p>
          <p className="text-xs text-neutral-500">Subtotal: {format_currency(row.subtotal)}</p>
          <p className="text-xs text-neutral-500">
            Shipping: {format_currency(row.shippingFee)} | Discount: {format_currency(row.discount)}
          </p>
        </div>
      );
    },
  }),
  column_helper.display({
    id: 'actions',
    header: '',
    cell: (props) => {
      const orderNumber = props.row.original.id;
      return (
        <Button asChild variant="outline" size="sm" className="whitespace-nowrap">
          <Link href={`/admin/orders/${encodeURIComponent(orderNumber)}`}>View details</Link>
        </Button>
      );
    },
  }),
];
