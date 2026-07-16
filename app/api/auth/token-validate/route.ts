import { NextRequest, NextResponse } from 'next/server';

import User from '@/models/User';
import connect_to_database from '@/lib/db';
import { hashToken } from '@/lib/auth/tokens';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      console.error('No token provided in request body');
      return NextResponse.json({ valid: false });
    }

    await connect_to_database();

    const hashed_token = hashToken(token);

    const found_user = await User.findOne({
      passwordResetTokenHash: hashed_token,
      passwordResetTokenExp: { $gt: new Date() },
    })
      .select('_id')
      .lean();

    if (!found_user) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
