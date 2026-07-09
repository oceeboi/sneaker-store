import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import PlatformSettings from '@/models/PlatformSettings';
import mongoose from 'mongoose';
import { AuditAction } from '@/models/Auditlog';

const updateSettingsSchema = z.object({
  rewardsEnabled: z.boolean().optional(),
  pointsPerNaira1000: z.number().min(0).optional(),
  pointsRedemptionBlock: z.number().min(1).optional(),
  pointsRedemptionValue: z.number().min(0).optional(),
  newCustomerDiscountEnabled: z.boolean().optional(),
  newCustomerDiscountPercent: z.number().min(0).max(100).optional(),
});

function format_validation_issues(issues: { path: PropertyKey[]; message: string }[]) {
  return validationErr(
    issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }))
  );
}

export async function GET() {
  const authorization = await requirePermission(Permission.SETTINGS_READ);
  if (!authorization.ok) return authorization.response;

  await connect_to_database();
  const settings = await PlatformSettings.findOne().lean();
  return ok({ settings: settings ?? (await PlatformSettings.create({})).toObject() });
}

export async function PATCH(req: NextRequest) {
  const authorization = await requirePermission(Permission.SETTINGS_WRITE);
  if (!authorization.ok) return authorization.response;

  const body = await req.json().catch(() => null);
  const validation_result = updateSettingsSchema.safeParse(body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  let settings = await PlatformSettings.findOne();
  if (!settings) settings = await PlatformSettings.create({});

  const old_values = settings.toObject() as unknown as Record<string, unknown>;
  Object.assign(settings, validation_result.data);
  await settings.save();
  const new_values = settings.toObject() as unknown as Record<string, unknown>;

  writeAuditLog({
    userId: null,
    actorId: new mongoose.Types.ObjectId(authorization.user.userId),
    action: AuditAction.SETTINGS_UPDATED,
    entityType: 'PlatformSettings',
    entityId: settings._id.toString(),
    oldValues: old_values,
    newValues: new_values,
    metadata: { resource: 'settings', domain: 'rewards' },
    ...requestMeta(req),
  });

  return ok({ settings: new_values });
}
