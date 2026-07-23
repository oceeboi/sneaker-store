import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import {
  adjust_inventory,
  fulfill_reserved_inventory,
  release_inventory,
  reserve_inventory,
} from '@/lib/inventory';
import { err, ok, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import InventoryMovement from '@/models/InventoryMovement';
import Product from '@/models/Product';
import {
  adminProductInventoryMutationSchema,
  adminProductInventoryQuerySchema,
} from '@/modules/products/schemas/admin-product-inventory.schemas';
import { formatValidationIssues } from '@/modules/products/services/admin-product-route-helpers';
import { InventoryMovementReason } from '@/types/shared/product';

async function get_product_id(ctx: RouteContext<'/api/admin/product/[id]/inventory'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/admin/product/[id]/inventory'>
) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const queryValidation = adminProductInventoryQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!queryValidation.success) {
    return formatValidationIssues(queryValidation.error.issues);
  }

  const limit = queryValidation.data.limit ?? 50;

  await connect_to_database();

  const [product, movements] = await Promise.all([
    Product.findById(product_id).select('name slug sizes').lean(),
    InventoryMovement.find({ productId: new Types.ObjectId(product_id) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        'size reason quantityDelta stockBefore stockAfter reservedBefore reservedAfter referenceType referenceId note actorId createdAt'
      )
      .lean(),
  ]);

  if (!product) {
    return err('Product not found', 404);
  }

  return ok({
    product: {
      id: product._id.toString(),
      name: product.name,
      slug: product.slug,
      sizes: product.sizes.map((size) => ({
        ...size,
        availableQuantity: Math.max(0, size.stockQuantity - size.reservedQuantity),
        isLowStock: size.stockQuantity <= size.reorderLevel,
      })),
    },
    movements: movements.map((movement) => ({
      id: movement._id.toString(),
      size: movement.size,
      reason: movement.reason,
      quantityDelta: movement.quantityDelta,
      stockBefore: movement.stockBefore,
      stockAfter: movement.stockAfter,
      reservedBefore: movement.reservedBefore,
      reservedAfter: movement.reservedAfter,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      note: movement.note,
      actorId: movement.actorId?.toString() ?? null,
      createdAt: movement.createdAt,
    })),
  });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/admin/product/[id]/inventory'>
) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const bodyValidation = adminProductInventoryMutationSchema.safeParse(request_body);
  if (!bodyValidation.success) {
    return formatValidationIssues(bodyValidation.error.issues);
  }

  const payload = bodyValidation.data;
  const operation = payload.operation;
  const size = payload.size;
  const quantity = payload.quantity;
  const note = payload.note ?? null;
  const reference_id = payload.referenceId ?? null;
  const reference_type = payload.referenceType ?? null;

  await connect_to_database();

  const context = {
    actorId: authorization.user.userId,
    note,
    referenceId: reference_id,
    referenceType: reference_type,
    metadata: {
      ipAddress: requestMeta(req).ipAddress,
    },
  };

  let result:
    | Awaited<ReturnType<typeof adjust_inventory>>
    | Awaited<ReturnType<typeof reserve_inventory>>
    | Awaited<ReturnType<typeof release_inventory>>
    | Awaited<ReturnType<typeof fulfill_reserved_inventory>>;

  if (operation === 'adjust_add') {
    result = await adjust_inventory({
      productId: product_id,
      size,
      quantityDelta: quantity,
      reason: InventoryMovementReason.RESTOCK,
      context,
    });
  } else if (operation === 'adjust_remove') {
    result = await adjust_inventory({
      productId: product_id,
      size,
      quantityDelta: -quantity,
      reason: InventoryMovementReason.ADJUSTMENT,
      context,
    });
  } else if (operation === 'reserve') {
    result = await reserve_inventory({ productId: product_id, size, quantity, context });
  } else if (operation === 'release') {
    result = await release_inventory({ productId: product_id, size, quantity, context });
  } else if (operation === 'fulfill') {
    result = await fulfill_reserved_inventory({
      productId: product_id,
      size,
      quantity,
      context,
    });
  } else {
    return err('Unsupported operation', 422);
  }

  if (!('ok' in result)) {
    const error_message = result.error ?? 'Inventory operation failed';
    const error_status = result.status ?? 400;
    return err(error_message, error_status);
  }

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'ProductInventory',
    entityId: product_id,
    newValues: {
      operation,
      size: result.size,
      referenceId: reference_id,
      referenceType: reference_type,
    },
    metadata: {
      resource: 'product_inventory',
      operation,
    },
    ...requestMeta(req),
  });

  return ok({
    operation,
    productId: result.productId,
    productName: result.productName,
    size: result.size,
  });
}
