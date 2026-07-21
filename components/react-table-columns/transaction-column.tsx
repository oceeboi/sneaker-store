import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionData, TransactionStatus } from '@/services/transaction.service';
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

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const column_helper = createColumnHelper<TransactionData>();

export const transaction_columns = [
  column_helper.accessor('reference', {
    header: () => (
      <span className="text-xs uppercase tracking-wide text-neutral-500">Reference</span>
    ),
    cell: (props) => <span className="font-semibold text-neutral-900">{props.getValue()}</span>,
  }),
  column_helper.accessor('createdAt', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Date</span>,
    cell: (props) => (
      <span className="text-sm text-neutral-500">{format_date(props.getValue())}</span>
    ),
  }),
  column_helper.accessor('status', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Status</span>,
    cell: (props) => (
      <Badge variant={STATUS_BADGE_VARIANT[props.getValue()]} className="capitalize">
        {props.getValue()}
      </Badge>
    ),
  }),
  column_helper.accessor('amount', {
    header: () => <span className="text-xs uppercase tracking-wide text-neutral-500">Amount</span>,
    cell: (props) => (
      <span className="font-medium text-neutral-900">{format_currency(props.getValue())}</span>
    ),
  }),
  column_helper.display({
    id: 'actions',
    header: '',
    cell: (props) => {
      const reference = props.row.original.reference;
      return (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/transactions/${encodeURIComponent(reference)}`}>View</Link>
        </Button>
      );
    },
  }),
];
