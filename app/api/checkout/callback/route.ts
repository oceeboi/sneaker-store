import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('trxref');
  const status = url.searchParams.get('status') ?? 'unknown';

  const redirect_url = new URL('/', url.origin);

  if (reference) {
    redirect_url.searchParams.set('reference', reference);
  }

  redirect_url.searchParams.set('paymentStatus', status);

  return NextResponse.redirect(redirect_url);
}
