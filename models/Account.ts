import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const AccountTier = {
  BASIC: 'basic',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
} as const;
export type AccountTier = (typeof AccountTier)[keyof typeof AccountTier];

export const MembershipStatus = {
  NONE: 'none',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export interface IAccount extends Document {
  userId: Types.ObjectId;
  tier: AccountTier;
  membershipStatus: MembershipStatus;
  membershipStartedAt: Date | null;
  membershipEndsAt: Date | null;
  storeCredit: number;
  totalSpent: number;
  loyaltyPoints: number;
  perksEnabled: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    tier: {
      type: String,
      enum: Object.values(AccountTier),
      default: AccountTier.BASIC,
    },

    membershipStatus: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.NONE,
    },

    membershipStartedAt: { type: Date, default: null },
    membershipEndsAt: { type: Date, default: null },

    storeCredit: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    perksEnabled: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'accounts',
  }
);

const Account: Model<IAccount> =
  mongoose.models.Account ?? mongoose.model<IAccount>('Account', AccountSchema);

export default Account;
