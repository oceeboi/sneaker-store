import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { serialize_cart } from '@/lib/serializers/cart';
import Cart from '@/models/Cart';

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_READ);
  if (!authorization.ok) return authorization.response;

  await connect_to_database();

  const search_params = req.nextUrl.searchParams;
  const status = search_params.get('status');
  const userId = search_params.get('userId');
  // idleMinutesGte lets the admin UI ask "show me carts idle 60+ min" without
  // needing a separate 'abandoned' route just to preview candidates
  const idle_minutes_gte = search_params.get('idleMinutesGte');
  const page = Math.max(1, Number(search_params.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(search_params.get('limit')) || 20));

  const query: Record<string, unknown> = {};

  if (status) {
    if (!['active', 'abandoned', 'converted'].includes(status)) {
      return err('Invalid status filter', 400);
    }
    query.status = status;
  }

  if (userId) {
    if (!Types.ObjectId.isValid(userId)) return err('Invalid userId', 400);
    query.user = new Types.ObjectId(userId);
  }

  if (idle_minutes_gte) {
    const minutes = Number(idle_minutes_gte);
    if (!Number.isFinite(minutes) || minutes < 0) {
      return err('Invalid idleMinutesGte', 400);
    }
    query.lastActivityAt = { $lte: new Date(Date.now() - minutes * 60000) };
  }

  const [carts, total_count] = await Promise.all([
    Cart.find(query)
      .populate('user', 'email username')
      .populate('items.product', 'name slug')
      .sort({ lastActivityAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Cart.countDocuments(query),
  ]);

  return ok({
    carts: carts.map(serialize_cart),
    pagination: {
      page,
      limit,
      totalCount: total_count,
      totalPages: Math.ceil(total_count / limit),
    },
  });
}
