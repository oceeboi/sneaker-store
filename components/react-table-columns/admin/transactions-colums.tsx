import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminTransactionData, TransactionStatus } from '@/services/transaction.service';
import { format_currency } from '@/utils/format';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';

const STATUS_BADGE_VARIANT: Record<
  TransactionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  success: 'secondary',
  failed: 'destructive',
  abandoned: 'destructive',
};

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_optional_date(value: Date | string | null) {
  if (!value) return 'Not available';
  return format_date(value);
}

function format_status(status: TransactionStatus) {
  return status.replaceAll('_', ' ');
}

function format_channel(channel: string | null) {
  if (!channel) return 'Unknown channel';
  return channel.replaceAll('_', ' ');
}

function truncate_middle(value: string, lead = 6, tail = 4) {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

function formatUserStatus(status: string | null | undefined) {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ');
}

const column_helper = createColumnHelper<AdminTransactionData>();

export const admin_transaction_columns = [
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
  column_helper.accessor('reference', {
    header: () => (
      <span className="text-xs uppercase tracking-wide text-neutral-500">Reference</span>
    ),
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="min-w-0 space-y-1">
          <p className="truncate font-semibold text-neutral-900" title={props.getValue()}>
            {props.getValue()}
          </p>
          <p className="truncate text-xs text-neutral-500" title={row.paystackReference ?? ''}>
            Gateway Ref: {row.paystackReference ? truncate_middle(row.paystackReference) : 'N/A'}
          </p>
          <p className="truncate text-xs text-neutral-500" title={row.orderId}>
            Order ID: {truncate_middle(row.orderId)}
          </p>
        </div>
      );
    },
  }),
  column_helper.accessor('createdAt', {
    header: () => (
      <span className="text-xs uppercase tracking-wide text-neutral-500">Timeline</span>
    ),
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="space-y-1">
          <p className="text-sm text-neutral-700">Created: {format_date(props.getValue())}</p>
          <p className="text-xs text-neutral-500">Paid: {format_optional_date(row.paidAt)}</p>
          <p className="text-xs text-neutral-500">
            Verified: {format_optional_date(row.verifiedAt)}
          </p>
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
            {format_status(status)}
          </Badge>
          {row.failureReason ? (
            <p className="max-w-[22ch] truncate text-xs text-red-600" title={row.failureReason}>
              Reason: {row.failureReason}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">No failure reason</p>
          )}
        </div>
      );
    },
  }),
  column_helper.accessor('amount', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Amount</span>,
    cell: (props) => {
      const row = props.row.original;

      return (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-neutral-900">{format_currency(props.getValue())}</p>
          <p className="text-xs text-neutral-500 uppercase">Currency: {row.currency || 'NGN'}</p>
          <p className="text-xs text-neutral-500 capitalize">
            Channel: {format_channel(row.channel)}
          </p>
        </div>
      );
    },
  }),
  column_helper.display({
    id: 'actions',
    header: '',
    cell: (props) => {
      const transaction_id = props.row.original.id;
      return (
        <Button asChild variant="outline" size="sm" className="whitespace-nowrap">
          <Link href={`/admin/transactions/${encodeURIComponent(transaction_id)}`}>
            View details
          </Link>
        </Button>
      );
    },
  }),
];
