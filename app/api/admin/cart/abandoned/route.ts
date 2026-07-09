// app/api/admin/cart/abandoned/route.ts
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Cart from '@/models/Cart';
import Notification, {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '@/models/Notification';
import { serialize_cart } from '@/lib/serializers/cart';
// import { send_abandoned_cart_email } from '../../emails/emails';

const scanAbandonedSchema = z.object({
  idleMinutes: z.number().int().min(1).default(120),
  notify: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

function format_validation_issues(issues: { path: PropertyKey[]; message: string }[]) {
  return validationErr(
    issues.map((issue) => ({
      path: issue.path.map((s) => (typeof s === 'symbol' ? s.toString() : s)) as (
        string | number
      )[],
      message: issue.message,
    }))
  );
}

function extract_object_id(value: unknown): Types.ObjectId | null {
  if (!value) return null;

  if (value instanceof Types.ObjectId) return value;

  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }

  if (typeof value === 'object' && '_id' in value) {
    const nested_id = (value as { _id: unknown })._id;
    return extract_object_id(nested_id);
  }

  return null;
}

// ─── GET — preview candidates, no mutation, no email ──────────────────────────

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_READ);
  if (!authorization.ok) return authorization.response;

  await connect_to_database();

  const idle_minutes = Number(req.nextUrl.searchParams.get('idleMinutes')) || 120;
  if (!Number.isFinite(idle_minutes) || idle_minutes < 1) {
    return err('Invalid idleMinutes', 400);
  }

  const candidates = await Cart.find({
    status: 'active',
    'items.0': { $exists: true },
    lastActivityAt: { $lte: new Date(Date.now() - idle_minutes * 60000) },
  })
    .populate('user', 'email username')
    .populate('items.product', 'name slug')
    .lean();

  return ok({
    candidateCount: candidates.length,
    idleMinutesThreshold: idle_minutes,
    carts: candidates.map(serialize_cart),
  });
}

// ─── POST — run the sweep: mark abandoned, email, log Notification per user ──

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const request_body = await req.json().catch(() => ({}));
  const validation_result = scanAbandonedSchema.safeParse(request_body);
  if (!validation_result.success) return format_validation_issues(validation_result.error.issues);

  const { idleMinutes, notify, dryRun } = validation_result.data;

  await connect_to_database();

  const candidates = await Cart.find({
    status: 'active',
    'items.0': { $exists: true },
    lastActivityAt: { $lte: new Date(Date.now() - idleMinutes * 60000) },
  })
    .populate('user', 'email username')
    .populate('items.product', 'name slug');

  if (dryRun) {
    return ok({
      dryRun: true,
      candidateCount: candidates.length,
      carts: candidates.map(serialize_cart),
    });
  }

  const results: {
    cartId: string;
    userId: string | null;
    emailed: boolean;
    notificationId: string | null;
    error?: string;
  }[] = [];

  for (const cart of candidates) {
    const old_status = cart.status;
    cart.status = 'abandoned';
    await cart.save();

    // Same enum gap as before: CART_CLEARED is the closest existing AuditAction.
    writeAuditLog({
      userId: null,
      actorId: new Types.ObjectId(authorization.user.userId),
      action: AuditAction.CART_CLEARED,
      entityType: 'Cart',
      entityId: cart._id.toString(),
      oldValues: { status: old_status },
      newValues: { status: 'abandoned' },
      metadata: { resource: 'cart', operation: 'admin.abandoned_sweep', idleMinutes },
      ...requestMeta(req),
    });

    const populated_user = cart.user as unknown as {
      _id?: unknown;
      email?: string;
      username?: string;
    };
    const populated_user_id = extract_object_id(populated_user?._id);

    const item_names = (cart.items as unknown as { product: { name?: string } }[])
      .map((item) => item.product?.name)
      .filter(Boolean)
      .join(', ');

    const idle_hours = Math.round(idleMinutes / 60);
    const cause_message_detailed = `Cart has been idle for over ${idle_hours} hour(s) with items still in it${item_names ? ` (${item_names})` : ''}.`;

    let emailed = false;
    let email_error: string | undefined;
    let notification_id: string | null = null;

    if (notify && populated_user?.email && populated_user_id) {
      try {
        //
        console.log(
          `Simulating sending abandoned cart email to ${populated_user.email} for cart ${cart._id.toString()}`
        );
        // emailed = await send_abandoned_cart_email(
        //   populated_user.email,
        //   populated_user.username ?? 'there',
        //   cause_message_detailed
        // );

        emailed = true; // Simulate success for now, since send_abandoned_cart_email is commented out.
      } catch (e) {
        emailed = false;
        email_error = e instanceof Error ? e.message : 'Unknown email error';
      }

      // Log the attempt as a real Notification, success or failure — this is
      // what makes it visible both in the user's own notification history
      // and to admins querying status: 'failed' across the collection.
      const notification = await Notification.create({
        userId: populated_user_id,
        type: NotificationType.CART_ABANDONED,
        channel: NotificationChannel.EMAIL,
        priority: emailed ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
        title: 'Items left in your cart',
        message: cause_message_detailed,
        emailAddress: populated_user.email,
        status: emailed ? NotificationStatus.SENT : NotificationStatus.FAILED,
        failureReason: emailed ? null : (email_error ?? 'send_abandoned_cart_email returned false'),
        sentAt: emailed ? new Date() : null,
        retryCount: 0,
        metadata: {
          cartId: cart._id.toString(),
          idleMinutes,
          itemNames: item_names || null,
        },
      });

      notification_id = notification.id;
    } else if (notify && populated_user?.email && !populated_user_id) {
      email_error = 'Cannot create notification: user id is missing or invalid';
    }

    results.push({
      cartId: cart._id.toString(),
      userId: populated_user_id?.toString() ?? null,
      emailed,
      notificationId: notification_id,
      error: email_error,
    });
  }

  const failed_count = results.filter((r) => notify && !r.emailed).length;

  return ok({
    processedCount: results.length,
    notified: results.filter((r) => r.emailed).length,
    failed: failed_count,
    results,
  });
}
