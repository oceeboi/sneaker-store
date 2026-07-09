import mongoose, { Document, Model, Schema, Types } from 'mongoose';
/**
 * @author Oghenekevwe Osieta <osieta33@agmail.com>
 */
export type OrderStatus =
  'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface IOrderItem {
  product: Types.ObjectId;
  sizeId: Types.ObjectId; // live ref — needed to locate the Product.sizes entry at fulfillment/release time
  name: string; // snapshot — product name at time of purchase
  size: string; // snapshot — size label at time of purchase
  sku: string; // snapshot
  quantity: number;
  unitPrice: number; // kobo, snapshot
  subtotal: number; // kobo, quantity * unitPrice at time of purchase
}

export interface IShippingAddress {
  addressId: mongoose.Types.ObjectId | null; // traceability: which saved Address this came from, if any
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
}

export interface IOrder extends Document {
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];

  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;

  shippingAddress: IShippingAddress;

  status: OrderStatus;
  transaction: Types.ObjectId | null;

  cancelledAt: Date | null;
  cancelReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sizeId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    addressId: { type: Schema.Types.ObjectId, ref: 'Address', default: null },
    label: { type: String, default: null, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (v: IOrderItem[]) => v.length > 0,
        message: 'An order must have at least one item',
      },
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    shippingAddress: { type: ShippingAddressSchema, required: true },

    status: {
      type: String,
      enum: [
        'pending_payment',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
      ],
      default: 'pending_payment',
      index: true,
    },
    transaction: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'orders',
  }
);

// Order history per user, most recent first
OrderSchema.index({ user: 1, createdAt: -1 });
// Admin ops queue — e.g. "all paid orders awaiting processing"
OrderSchema.index({ status: 1, createdAt: -1 });
// Timeout-release safety net query target
OrderSchema.index({ status: 1, updatedAt: 1 });

const Order: Model<IOrder> = mongoose.models.Order ?? mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
