import { ICart } from '@/models/Cart';

type SerializableCartItem = {
  product: unknown;
  sizeId: { toString(): string };
  size: string;
  sku: string;
  quantity: number;
  priceAtAdd: number;
};

function serialize_cart_user(user: unknown) {
  if (user && typeof user === 'object' && '_id' in user) {
    const populated = user as { _id: { toString(): string }; email?: string; username?: string };
    return {
      id: populated._id.toString(),
      email: populated.email ?? null,
      username: populated.username ?? null,
    };
  }
  return { id: String(user), email: null, username: null };
}

function serialize_cart_item(item: SerializableCartItem) {
  const populated_product =
    item.product && typeof item.product === 'object' && '_id' in item.product
      ? (item.product as { _id: { toString(): string }; name?: string; slug?: string })
      : null;

  return {
    product: populated_product
      ? {
          id: populated_product._id.toString(),
          name: populated_product.name ?? null,
          slug: populated_product.slug ?? null,
        }
      : { id: String(item.product), name: null, slug: null },
    sizeId: item.sizeId.toString(),
    size: item.size,
    sku: item.sku,
    quantity: item.quantity,
    priceAtAdd: item.priceAtAdd,
    subtotal: item.priceAtAdd * item.quantity,
  };
}

export function serialize_cart(cart: {
  _id: { toString(): string };
  user: unknown;
  items: SerializableCartItem[];
  status: ICart['status'];
  currency: string;
  lastActivityAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const items = cart.items.map(serialize_cart_item);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const idle_minutes = Math.round((Date.now() - new Date(cart.lastActivityAt).getTime()) / 60000);

  return {
    id: cart._id.toString(),
    user: serialize_cart_user(cart.user),
    items,
    itemCount: items.length,
    total,
    status: cart.status,
    currency: cart.currency,
    lastActivityAt: cart.lastActivityAt,
    idleMinutes: idle_minutes,
    createdAt: cart.createdAt ?? null,
    updatedAt: cart.updatedAt ?? null,
  };
}
