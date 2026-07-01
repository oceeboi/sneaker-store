import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IReferral extends Document {
  userId: mongoose.Types.ObjectId;
  referralCode: string;
  successfulReferrals: number;
  pendingReferrals: number;
  pointsEarned: number;
  pointsAvailable: number;
  pointsRedeemed: number;
  totalRewards: number;
  isActive: boolean;
  lastRewardAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    referralCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 4,
      maxlength: 20,
      index: true,
    },

    successfulReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },

    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    pointsAvailable: {
      type: Number,
      default: 0,
      min: 0,
    },

    pointsRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRewards: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastRewardAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'referrals',
  }
);

const Referral: Model<IReferral> =
  mongoose.models.Referral ?? mongoose.model<IReferral>('Referral', ReferralSchema);

export default Referral;
