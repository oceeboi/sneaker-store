import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export interface ITransaction extends Document {
  order: Types.ObjectId;
  user: Types.ObjectId;

  reference: string; // your generated ref, sent to Paystack
  paystackReference: string | null; // Paystack's own ref, from their response/webhook

  amount: number; // kobo — snapshot, must match order.total at creation time
  currency: string;

  status: TransactionStatus;
  channel: string | null; // card, bank, ussd — from Paystack webhook payload

  paidAt: Date | null;
  verifiedAt: Date | null; // when you server-side verified via Paystack's /transaction/verify
  failureReason: string | null;

  // Raw Paystack payload — audit/debugging only, never sent to the client
  gatewayResponse: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    reference: { type: String, required: true, unique: true, index: true },
    paystackReference: { type: String, default: null },

    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'abandoned'],
      default: 'pending',
      index: true,
    },
    channel: { type: String, default: null },

    paidAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },

    gatewayResponse: { type: Schema.Types.Mixed, default: null, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'transactions',
  }
);

// All attempts for a given order, most recent first
TransactionSchema.index({ order: 1, createdAt: -1 });
// Timeout-release safety net: find pending transactions older than N minutes
TransactionSchema.index({ status: 1, createdAt: 1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;
