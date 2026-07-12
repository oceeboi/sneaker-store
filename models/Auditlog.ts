import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// ─── Action enum ──────────────────────────────────────────────────────────────
export const AuditAction = {
  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  // Email
  EMAIL_VERIFY_SENT: 'EMAIL_VERIFY_SENT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  // Password
  PASSWORD_RESET_SENT: 'PASSWORD_RESET_SENT',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  // Profile / KYC (referenced here but owned by other collections)
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  KYC_SUBMITTED: 'KYC_SUBMITTED',
  KYC_APPROVED: 'KYC_APPROVED',
  KYC_REJECTED: 'KYC_REJECTED',

  // Catalog
  CATALOG_ENTITY_CREATED: 'CATALOG_ENTITY_CREATED',
  CATALOG_ENTITY_UPDATED: 'CATALOG_ENTITY_UPDATED',
  CATALOG_ENTITY_DELETED: 'CATALOG_ENTITY_DELETED',

  // Cart
  CART_ITEM_ADDED: 'CART_ITEM_ADDED',
  CART_ITEM_REMOVED: 'CART_ITEM_REMOVED',
  CART_ITEM_UPDATED: 'CART_ITEM_UPDATED',
  CART_CLEARED: 'CART_CLEARED',

  //SETTINGS
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',

  // Order //
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_PAID: 'ORDER_PAID',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',

  // Transaction //
  TRANSACTION_INITIATED: 'TRANSACTION_INITIATED',
  TRANSACTION_SUCCESSFUL: 'TRANSACTION_SUCCESSFUL',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_ABANDONED: 'TRANSACTION_ABANDONED',

  // Rewards
  REWARDS_REDEEMED: 'REWARDS_REDEEMED',

  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// ─── Document interface ────────────────────────────────────────────────────────
export interface IAuditLog extends Document {
  userId: Types.ObjectId | null; // null for pre-auth failures
  actorId: Types.ObjectId | null; // same as userId unless admin acted
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────────
const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, enum: Object.values(AuditAction), index: true },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    oldValues: { type: Schema.Types.Mixed, default: null },
    newValues: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    // AuditLog is append-only — no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'audit_logs',
  }
);

// TTL index — retain logs for 7 years (regulatory minimum for broker records)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
