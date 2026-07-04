import mongoose, { Document, Model, Schema, Types } from 'mongoose';

import { InventoryMovementReason } from '@/types/shared/product';

export interface IInventoryMovement extends Document {
  productId: Types.ObjectId;
  size: string;
  reason: (typeof InventoryMovementReason)[keyof typeof InventoryMovementReason];
  quantityDelta: number; // positive = add/release, negative = remove/reserve/fulfill
  stockBefore: number;
  stockAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  actorId: Types.ObjectId | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    size: { type: String, required: true, trim: true, index: true },
    reason: {
      type: String,
      enum: Object.values(InventoryMovementReason),
      required: true,
      index: true,
    },
    quantityDelta: { type: Number, required: true },
    stockBefore: { type: Number, required: true, min: 0 },
    stockAfter: { type: Number, required: true, min: 0 },
    reservedBefore: { type: Number, required: true, min: 0 },
    reservedAfter: { type: Number, required: true, min: 0 },
    referenceType: { type: String, default: null },
    referenceId: { type: String, default: null },
    note: { type: String, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'inventory_movements',
  }
);

InventoryMovementSchema.index({ productId: 1, size: 1, createdAt: -1 });
InventoryMovementSchema.index({ reason: 1, createdAt: -1 });

const InventoryMovement: Model<IInventoryMovement> =
  mongoose.models.InventoryMovement ??
  mongoose.model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema);

export default InventoryMovement;