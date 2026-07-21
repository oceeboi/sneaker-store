'use client';
import { useOrderQuery } from '@/hooks/order.hook';

export default function OrderDetailsPage() {
  const { data: order } = useOrderQuery('');
  return (
    <div>
      <div>working here....</div>
    </div>
  );
}
