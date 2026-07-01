import { Types } from 'mongoose';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Address, { AddressType } from '@/models/Address';

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

  const found_addresses = await Address.find({ userId: user_id })
    .select(
      'type label firstName lastName phone street city state country postalCode isDefault createdAt updatedAt'
    )
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();

  const billing_addresses = found_addresses.filter(
    (address) => address.type === AddressType.BILLING || address.type === AddressType.BOTH
  );
  const shipping_addresses = found_addresses.filter(
    (address) => address.type === AddressType.SHIPPING || address.type === AddressType.BOTH
  );

  return ok({
    addresses: found_addresses.map((address) => ({
      id: address._id.toString(),
      type: address.type,
      label: address.label,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    })),
    defaults: {
      billing: billing_addresses[0]
        ? {
            id: billing_addresses[0]._id.toString(),
            type: billing_addresses[0].type,
            label: billing_addresses[0].label,
            firstName: billing_addresses[0].firstName,
            lastName: billing_addresses[0].lastName,
            phone: billing_addresses[0].phone,
            street: billing_addresses[0].street,
            city: billing_addresses[0].city,
            state: billing_addresses[0].state,
            country: billing_addresses[0].country,
            postalCode: billing_addresses[0].postalCode,
            isDefault: billing_addresses[0].isDefault,
            createdAt: billing_addresses[0].createdAt,
            updatedAt: billing_addresses[0].updatedAt,
          }
        : null,
      shipping: shipping_addresses[0]
        ? {
            id: shipping_addresses[0]._id.toString(),
            type: shipping_addresses[0].type,
            label: shipping_addresses[0].label,
            firstName: shipping_addresses[0].firstName,
            lastName: shipping_addresses[0].lastName,
            phone: shipping_addresses[0].phone,
            street: shipping_addresses[0].street,
            city: shipping_addresses[0].city,
            state: shipping_addresses[0].state,
            country: shipping_addresses[0].country,
            postalCode: shipping_addresses[0].postalCode,
            isDefault: shipping_addresses[0].isDefault,
            createdAt: shipping_addresses[0].createdAt,
            updatedAt: shipping_addresses[0].updatedAt,
          }
        : null,
    },
  });
}
