import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Address, { AddressType } from '@/models/Address';
import Notification, {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/models/Notification';
import { upsertAddressSchema } from '@/schemas/user.schemas';

export async function GET() {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(auth_result.userId);
  const found_address = await Address.findOne({ userId: user_id, type: AddressType.SHIPPING })
    .select(
      'type label firstName lastName phone street city state country postalCode isDefault createdAt updatedAt'
    )
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();

  if (!found_address) {
    return err('Shipping address not found', 404);
  }

  return ok({
    address: {
      id: found_address._id.toString(),
      type: found_address.type,
      label: found_address.label,
      firstName: found_address.firstName,
      lastName: found_address.lastName,
      phone: found_address.phone,
      street: found_address.street,
      city: found_address.city,
      state: found_address.state,
      country: found_address.country,
      postalCode: found_address.postalCode,
      isDefault: found_address.isDefault,
      createdAt: found_address.createdAt,
      updatedAt: found_address.updatedAt,
    },
  });
}

export async function PUT(req: NextRequest) {
  return upsert_typed_address(req, AddressType.SHIPPING);
}

export async function PATCH(req: NextRequest) {
  return upsert_typed_address(req, AddressType.SHIPPING);
}

async function upsert_typed_address(req: NextRequest, address_type: AddressType) {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = upsertAddressSchema.safeParse(request_body);
  const audit_meta = requestMeta(req);

  if (!validation_result.success) {
    const validation_issues = validation_result.error.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }));

    return validationErr(validation_issues);
  }

  await connect_to_database();

  const session = await mongoose.startSession();

  const upsert_result = await session.withTransaction(async () => {
    const user_id = new Types.ObjectId(auth_result.userId);

    const existing_address = await Address.findOne({ userId: user_id, type: address_type })
      .sort({ isDefault: -1, updatedAt: -1 })
      .session(session);

    await Address.updateMany(
      { userId: user_id, type: address_type, isDefault: true },
      { $set: { isDefault: false } },
      { session }
    );

    if (existing_address) {
      Object.assign(existing_address, {
        ...validation_result.data,
        type: address_type,
        isDefault: true,
      });

      await existing_address.save({ session });
      return { address_record: existing_address, operation_type: 'updated' as const };
    }

    const [created_address] = await Address.create(
      [
        {
          userId: user_id,
          type: address_type,
          isDefault: true,
          ...validation_result.data,
        },
      ],
      { session }
    );

    return { address_record: created_address, operation_type: 'added' as const };
  });

  await session.endSession();

  writeAuditLog({
    userId: new Types.ObjectId(auth_result.userId),
    action: AuditAction.PROFILE_UPDATED,
    entityType: 'Address',
    entityId: upsert_result.address_record._id.toString(),
    metadata: {
      addressType: address_type,
      operation: upsert_result.operation_type,
    },
    newValues: validation_result.data,
    ...audit_meta,
  });

  Notification.create({
    userId: new Types.ObjectId(auth_result.userId),
    type:
      upsert_result.operation_type === 'added'
        ? NotificationType.ADDRESS_ADDED
        : NotificationType.ADDRESS_UPDATED,
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.NORMAL,
    title:
      upsert_result.operation_type === 'added'
        ? 'Shipping Address Added'
        : 'Shipping Address Updated',
    message:
      upsert_result.operation_type === 'added'
        ? 'A shipping address was added to your account.'
        : 'Your shipping address was updated.',
    metadata: {
      addressId: upsert_result.address_record._id.toString(),
      addressType: address_type,
      operation: upsert_result.operation_type,
      ipAddress: audit_meta.ipAddress,
    },
  }).catch((notification_error: unknown) => {
    console.error('[Notification] shipping address alert failed:', notification_error);
  });

  return ok({
    address: {
      id: upsert_result.address_record._id.toString(),
      type: upsert_result.address_record.type,
      label: upsert_result.address_record.label,
      firstName: upsert_result.address_record.firstName,
      lastName: upsert_result.address_record.lastName,
      phone: upsert_result.address_record.phone,
      street: upsert_result.address_record.street,
      city: upsert_result.address_record.city,
      state: upsert_result.address_record.state,
      country: upsert_result.address_record.country,
      postalCode: upsert_result.address_record.postalCode,
      isDefault: upsert_result.address_record.isDefault,
      createdAt: upsert_result.address_record.createdAt,
      updatedAt: upsert_result.address_record.updatedAt,
    },
  });
}
