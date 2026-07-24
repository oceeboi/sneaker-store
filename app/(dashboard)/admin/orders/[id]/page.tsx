'use client';
import { useAdminOrderQuery } from '@/hooks/order.hook';
import { useParams } from 'next/navigation';

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const order_number = decodeURIComponent(params?.id ?? '').trim();
  const {
    data: admin_order_view_by_id,
    isError: is_admin_order_error,
    error: admin_error,
  } = useAdminOrderQuery(order_number);
  return (
    <div>
      <div>{admin_order_view_by_id?.id}</div>

      {is_admin_order_error && admin_error.message}
    </div>
  );
}
