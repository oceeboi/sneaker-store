import { Types } from 'mongoose';

import InventoryMovement from '@/models/InventoryMovement';
import Product from '@/models/Product';
import { InventoryMovementReason } from '@/types/shared/product';

type InventoryContext = {
  actorId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SizeSnapshot = {
  size: string;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  active: boolean;
};

function normalize_size_key(size: string): string {
  return size.trim().toLowerCase();
}

function clone_size_snapshot(size: {
  size: string;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  active: boolean;
}): SizeSnapshot {
  return {
    size: size.size,
    sku: size.sku,
    barcode: size.barcode,
    stockQuantity: size.stockQuantity,
    reservedQuantity: size.reservedQuantity,
    reorderLevel: size.reorderLevel,
    active: size.active,
  };
}

function map_size_for_response(size: SizeSnapshot) {
  return {
    ...size,
    availableQuantity: Math.max(0, size.stockQuantity - size.reservedQuantity),
    isLowStock: size.stockQuantity <= size.reorderLevel,
  };
}

async function write_inventory_movement(input: {
  productId: Types.ObjectId;
  size: string;
  reason: (typeof InventoryMovementReason)[keyof typeof InventoryMovementReason];
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  context?: InventoryContext;
}) {
  await InventoryMovement.create({
    productId: input.productId,
    size: input.size,
    reason: input.reason,
    quantityDelta: input.quantityDelta,
    stockBefore: input.stockBefore,
    stockAfter: input.stockAfter,
    reservedBefore: input.reservedBefore,
    reservedAfter: input.reservedAfter,
    referenceType: input.context?.referenceType ?? null,
    referenceId: input.context?.referenceId ?? null,
    note: input.context?.note ?? null,
    actorId: input.context?.actorId ? new Types.ObjectId(input.context.actorId) : null,
    metadata: input.context?.metadata ?? null,
  });
}

async function load_product_size(productId: string, size: string) {
  const product = await Product.findById(productId).select('name sizes').lean();
  if (!product) {
    return { error: 'Product not found', status: 404 as const };
  }

  const size_key = normalize_size_key(size);
  const found_size = product.sizes.find((item) => normalize_size_key(item.size) === size_key);

  if (!found_size) {
    return { error: 'Size not found on product', status: 404 as const };
  }

  return {
    product,
    size: clone_size_snapshot(found_size),
  };
}

export async function adjust_inventory(input: {
  productId: string;
  size: string;
  quantityDelta: number;
  reason?: (typeof InventoryMovementReason)[keyof typeof InventoryMovementReason];
  context?: InventoryContext;
}) {
  if (input.quantityDelta === 0) {
    return { error: 'Quantity delta cannot be zero', status: 400 as const };
  }

  const loaded = await load_product_size(input.productId, input.size);
  if ('error' in loaded) return loaded;

  const size_before = loaded.size;
  const size_after_stock = size_before.stockQuantity + input.quantityDelta;

  if (size_after_stock < 0) {
    return { error: 'Stock cannot go below zero', status: 409 as const };
  }

  if (size_after_stock < size_before.reservedQuantity) {
    return { error: 'Stock cannot be lower than reserved quantity', status: 409 as const };
  }

  const update_result = await Product.updateOne(
    {
      _id: loaded.product._id,
      sizes: {
        $elemMatch: {
          size: size_before.size,
          stockQuantity: size_before.stockQuantity,
          reservedQuantity: size_before.reservedQuantity,
        },
      },
    },
    {
      $set: { 'sizes.$.stockQuantity': size_after_stock },
    }
  );

  if (update_result.matchedCount === 0) {
    return { error: 'Inventory changed concurrently, retry operation', status: 409 as const };
  }

  await write_inventory_movement({
    productId: loaded.product._id,
    size: size_before.size,
    reason: input.reason ?? InventoryMovementReason.ADJUSTMENT,
    quantityDelta: input.quantityDelta,
    stockBefore: size_before.stockQuantity,
    stockAfter: size_after_stock,
    reservedBefore: size_before.reservedQuantity,
    reservedAfter: size_before.reservedQuantity,
    context: input.context,
  });

  return {
    ok: true as const,
    productId: loaded.product._id.toString(),
    productName: loaded.product.name,
    size: map_size_for_response({
      ...size_before,
      stockQuantity: size_after_stock,
    }),
  };
}

export async function reserve_inventory(input: {
  productId: string;
  size: string;
  quantity: number;
  context?: InventoryContext;
}) {
  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than zero', status: 400 as const };
  }

  const loaded = await load_product_size(input.productId, input.size);
  if ('error' in loaded) return loaded;

  const size_before = loaded.size;

  if (!size_before.active) {
    return { error: 'Size is not active', status: 409 as const };
  }

  const available_quantity = size_before.stockQuantity - size_before.reservedQuantity;
  if (available_quantity < input.quantity) {
    return { error: 'Insufficient available stock for reservation', status: 409 as const };
  }

  const reserved_after = size_before.reservedQuantity + input.quantity;

  const update_result = await Product.updateOne(
    {
      _id: loaded.product._id,
      sizes: {
        $elemMatch: {
          size: size_before.size,
          stockQuantity: size_before.stockQuantity,
          reservedQuantity: size_before.reservedQuantity,
        },
      },
    },
    {
      $set: { 'sizes.$.reservedQuantity': reserved_after },
    }
  );

  if (update_result.matchedCount === 0) {
    return { error: 'Inventory changed concurrently, retry operation', status: 409 as const };
  }

  await write_inventory_movement({
    productId: loaded.product._id,
    size: size_before.size,
    reason: InventoryMovementReason.RESERVATION,
    quantityDelta: -input.quantity,
    stockBefore: size_before.stockQuantity,
    stockAfter: size_before.stockQuantity,
    reservedBefore: size_before.reservedQuantity,
    reservedAfter: reserved_after,
    context: input.context,
  });

  return {
    ok: true as const,
    productId: loaded.product._id.toString(),
    productName: loaded.product.name,
    size: map_size_for_response({
      ...size_before,
      reservedQuantity: reserved_after,
    }),
  };
}

export async function release_inventory(input: {
  productId: string;
  size: string;
  quantity: number;
  context?: InventoryContext;
}) {
  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than zero', status: 400 as const };
  }

  const loaded = await load_product_size(input.productId, input.size);
  if ('error' in loaded) return loaded;

  const size_before = loaded.size;

  if (size_before.reservedQuantity < input.quantity) {
    return { error: 'Cannot release more than reserved quantity', status: 409 as const };
  }

  const reserved_after = size_before.reservedQuantity - input.quantity;

  const update_result = await Product.updateOne(
    {
      _id: loaded.product._id,
      sizes: {
        $elemMatch: {
          size: size_before.size,
          stockQuantity: size_before.stockQuantity,
          reservedQuantity: size_before.reservedQuantity,
        },
      },
    },
    {
      $set: { 'sizes.$.reservedQuantity': reserved_after },
    }
  );

  if (update_result.matchedCount === 0) {
    return { error: 'Inventory changed concurrently, retry operation', status: 409 as const };
  }

  await write_inventory_movement({
    productId: loaded.product._id,
    size: size_before.size,
    reason: InventoryMovementReason.CANCELLATION,
    quantityDelta: input.quantity,
    stockBefore: size_before.stockQuantity,
    stockAfter: size_before.stockQuantity,
    reservedBefore: size_before.reservedQuantity,
    reservedAfter: reserved_after,
    context: input.context,
  });

  return {
    ok: true as const,
    productId: loaded.product._id.toString(),
    productName: loaded.product.name,
    size: map_size_for_response({
      ...size_before,
      reservedQuantity: reserved_after,
    }),
  };
}

export async function fulfill_reserved_inventory(input: {
  productId: string;
  size: string;
  quantity: number;
  context?: InventoryContext;
}) {
  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than zero', status: 400 as const };
  }

  const loaded = await load_product_size(input.productId, input.size);
  if ('error' in loaded) return loaded;

  const size_before = loaded.size;

  if (size_before.reservedQuantity < input.quantity) {
    return { error: 'Insufficient reserved quantity', status: 409 as const };
  }

  if (size_before.stockQuantity < input.quantity) {
    return { error: 'Insufficient stock quantity', status: 409 as const };
  }

  const reserved_after = size_before.reservedQuantity - input.quantity;
  const stock_after = size_before.stockQuantity - input.quantity;

  const update_result = await Product.updateOne(
    {
      _id: loaded.product._id,
      sizes: {
        $elemMatch: {
          size: size_before.size,
          stockQuantity: size_before.stockQuantity,
          reservedQuantity: size_before.reservedQuantity,
        },
      },
    },
    {
      $set: {
        'sizes.$.reservedQuantity': reserved_after,
        'sizes.$.stockQuantity': stock_after,
      },
    }
  );

  if (update_result.matchedCount === 0) {
    return { error: 'Inventory changed concurrently, retry operation', status: 409 as const };
  }

  await write_inventory_movement({
    productId: loaded.product._id,
    size: size_before.size,
    reason: InventoryMovementReason.PURCHASE,
    quantityDelta: -input.quantity,
    stockBefore: size_before.stockQuantity,
    stockAfter: stock_after,
    reservedBefore: size_before.reservedQuantity,
    reservedAfter: reserved_after,
    context: input.context,
  });

  return {
    ok: true as const,
    productId: loaded.product._id.toString(),
    productName: loaded.product.name,
    size: map_size_for_response({
      ...size_before,
      stockQuantity: stock_after,
      reservedQuantity: reserved_after,
    }),
  };
}