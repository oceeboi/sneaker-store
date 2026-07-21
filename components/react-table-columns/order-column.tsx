import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format_currency } from '@/utils/format';

type OrderStatus =
  'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

type OrderSummaryData = {
  id: string;
  orderNumber: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;
  status: OrderStatus;
  transactionId: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function formatStatus(status: OrderStatus) {
  return status.replaceAll('_', ' ');
}

const column_helper = createColumnHelper<OrderSummaryData>();

export const order_columns = [
  column_helper.accessor('orderNumber', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Order</span>,
    cell: (props) => <span className="font-semibold text-neutral-900">{props.getValue()}</span>,
  }),
  column_helper.accessor('createdAt', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Placed</span>,
    cell: (props) => (
      <span className="text-sm text-neutral-500">{formatDate(props.getValue())}</span>
    ),
  }),
  column_helper.accessor('status', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Status</span>,
    cell: (props) => {
      const status = props.getValue();
      return (
        <Badge variant={STATUS_BADGE_VARIANT[status]} className="capitalize">
          {formatStatus(status)}
        </Badge>
      );
    },
  }),
  column_helper.accessor('total', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Total</span>,
    cell: (props) => {
      const row = props.row.original;
      return (
        <span className="font-medium text-neutral-900">{format_currency(props.getValue())}</span>
      );
    },
  }),
  column_helper.display({
    id: 'actions',
    header: '',
    cell: (props) => {
      const orderNumber = props.row.original.orderNumber;
      return (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/orders/${encodeURIComponent(orderNumber)}`}>View</Link>
        </Button>
      );
    },
  }),
];
