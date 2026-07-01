import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const NotificationType = {
  // Auth & account
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  LOGIN_NEW_DEVICE: 'LOGIN_NEW_DEVICE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  // Products & promotions
  NEW_ARRIVAL: 'NEW_ARRIVAL',
  PRODUCT_BACK_IN_STOCK: 'PRODUCT_BACK_IN_STOCK',
  PROMOTION_AVAILABLE: 'PROMOTION_AVAILABLE',

  // Cart & checkout
  CART_PENDING: 'CART_PENDING',
  CART_UPDATED: 'CART_UPDATED',
  CART_REMINDER: 'CART_REMINDER',
  CART_EXPIRED: 'CART_EXPIRED',
  CART_ABANDONED: 'CART_ABANDONED',

  // Orders
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_RETURNED: 'ORDER_RETURNED',

  // Payments
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_REQUIRES_ACTION: 'PAYMENT_REQUIRES_ACTION',

  // General
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  SECURITY_ALERT: 'SECURITY_ALERT',
  REFERRAL_REWARD: 'REFERRAL_REWARD',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  DELIVERED: 'delivered',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent', // security alerts, margin calls
} as const;
export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];

// ─── Document interface ────────────────────────────────────────────────────────
export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  // in-app state
  read: boolean;
  readAt: Date | null;
  // email state
  emailAddress: string | null;
  emailMessageId: string | null; // Resend message ID for delivery tracking
  // delivery state
  status: NotificationStatus;
  failureReason: string | null;
  retryCount: number;
  sentAt: Date | null;
  // extra data surfaced in the notification (e.g. trade symbol, amount)
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────────
const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: Object.values(NotificationType),
      index: true,
    },

    channel: {
      type: String,
      required: true,
      enum: Object.values(NotificationChannel),
    },

    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.NORMAL,
    },

    title: { type: String, required: true },
    message: { type: String, required: true },

    // in-app
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    // email
    emailAddress: { type: String, default: null },
    emailMessageId: { type: String, default: null },

    // delivery
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    failureReason: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },

    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'notifications',
  }
);

// Compound index — fast unread count queries per user
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Compound index — resend/retry jobs
NotificationSchema.index({ status: 1, retryCount: 1, createdAt: 1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
