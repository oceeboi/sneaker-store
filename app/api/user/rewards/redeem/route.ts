import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import { redeem_points_to_credit } from '@/lib/services/loyalty.service';
import { Types } from 'mongoose';

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.REWARDS_REDEEM); // reuse an existing customer-tier permission, or add REWARDS_REDEEM to rbac.ts
  if (!authorization.ok) return authorization.response;

  await connect_to_database();

  const user_id = new Types.ObjectId(authorization.user.userId);
  const result = await redeem_points_to_credit(user_id);

  if (!result.redeemed) {
    return err(result.reason ?? 'Unable to redeem points', 409);
  }

  writeAuditLog({
    userId: user_id,
    actorId: user_id,
    action: AuditAction.REWARDS_REDEEMED, // no dedicated REWARDS_REDEEMED action yet — flag for a proper enum entry
    entityType: 'Account',
    entityId: user_id.toString(),
    oldValues: {},
    newValues: result,
    metadata: { resource: 'rewards', operation: 'redeem' },
    ...requestMeta(req),
  });

  return ok(result);
}
