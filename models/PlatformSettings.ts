import mongoose, { Document, Model, Schema } from 'mongoose';
/**
 * @author Oghenekevwe Osieta <osieta33@agmail.com>
 */
// Singleton document — there is only ever one PlatformSettings row.
// This is the master switchboard for features that aren't ready to be
// permanent yet. Nothing in checkout/webhook logic should hardcode these
// numbers directly — always read from here, so a client decision to pause
// or change the program never requires a code deploy.

export interface IPlatformSettings extends Document {
  // ─── Loyalty & Rewards (the whole system can be OFF) ───
  rewardsEnabled: boolean;
  pointsPerNaira1000: number; // e.g. 1 point per ₦1,000 spent
  pointsRedemptionBlock: number; // e.g. 300 points
  pointsRedemptionValue: number; // e.g. 25000 (naira value of one redemption block)

  // ─── New customer discount (independently toggleable) ───
  newCustomerDiscountEnabled: boolean;
  newCustomerDiscountPercent: number; // e.g. 5

  updatedAt: Date;
  createdAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    rewardsEnabled: { type: Boolean, default: false }, // starts OFF — deliberate default
    pointsPerNaira1000: { type: Number, default: 1, min: 0 },
    pointsRedemptionBlock: { type: Number, default: 300, min: 1 },
    pointsRedemptionValue: { type: Number, default: 25000, min: 0 }, // naira, not kobo — converted at use-time

    newCustomerDiscountEnabled: { type: Boolean, default: true },
    newCustomerDiscountPercent: { type: Number, default: 5, min: 0, max: 100 },
  },
  { timestamps: true, versionKey: false, collection: 'platform_settings' }
);

const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ??
  mongoose.model<IPlatformSettings>('PlatformSettings', PlatformSettingsSchema);

export default PlatformSettings;
