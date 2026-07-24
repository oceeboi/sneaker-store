'use client';
import { useParams } from 'next/navigation';

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const order_number = decodeURIComponent(params?.id ?? '').trim();

  return (
    <div>
      <div>{order_number}</div>
    </div>
  );
}
