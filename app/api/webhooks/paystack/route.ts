import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import connect_to_database from '@/lib/db';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import {
  process_failed_payment,
  process_successful_payment,
  verify_transaction_with_paystack,
} from '@/lib/services/payment.service';

function verify_paystack_signature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected_hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY as string)
    .update(rawBody)
    .digest('hex');

  if (expected_hash.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected_hash), Buffer.from(signatureHeader));
}

export async function POST(req: NextRequest) {
  const raw_body = await req.text();
  const signature_header = req.headers.get('x-paystack-signature');

  if (!verify_paystack_signature(raw_body, signature_header)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw_body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const event_type = event.event;
  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  await connect_to_database();

  const transaction = await Transaction.findOne({ reference });
  if (!transaction) {
    return NextResponse.json({ received: true, note: 'Unknown reference' }, { status: 200 });
  }

  if (transaction.status === 'success' || transaction.status === 'failed') {
    return NextResponse.json({ received: true, note: 'Already processed' }, { status: 200 });
  }

  const order = await Order.findById(transaction.order);
  if (!order) {
    return NextResponse.json({ received: true, note: 'Order not found' }, { status: 200 });
  }

  if (event_type !== 'charge.success' && event_type !== 'charge.failed') {
    return NextResponse.json({ received: true, note: 'Event type not handled' }, { status: 200 });
  }

  const verification = await verify_transaction_with_paystack(reference);

  if (!verification.verified) {
    return NextResponse.json(
      { received: true, note: 'Verification unavailable, will retry' },
      { status: 200 }
    );
  }

  if (verification.status === 'success') {
    const result = await process_successful_payment(order, transaction, verification, 'webhook');
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  }

  const result = await process_failed_payment(
    order,
    transaction,
    String(verification.raw?.gateway_response ?? 'Payment declined'),
    verification.raw ?? null,
    'webhook'
  );
  return NextResponse.json({ received: true, ...result }, { status: 200 });
}
