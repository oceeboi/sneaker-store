import mongoose, { Document, Model, Schema } from 'mongoose';

export const AddressType = {
  BILLING: 'billing',
  SHIPPING: 'shipping',
  BOTH: 'both',
} as const;
export type AddressType = (typeof AddressType)[keyof typeof AddressType];

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  type: AddressType;
  label: string | null; // e.g "Home", "Office"
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AddressType),
      default: AddressType.BOTH,
    },
    label: {
      type: String,
      default: null,
      trim: true,
      maxlength: 30, // "Home", "Office", "Mom's place"
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'Nigeria',
    },
    postalCode: {
      type: String,
      default: null,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'addresses',
  }
);

// Ensure only one default address per user per type
AddressSchema.index(
  { userId: 1, isDefault: 1, type: 1 },
  { unique: false } // not unique but useful for queries
);

// ─── Pre-save: if this address is set as default,
// unset all other defaults for same user and type ──────────────────────────
AddressSchema.pre('save', async function () {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('Address').updateMany(
      {
        userId: this.userId,
        type: { $in: [this.type, AddressType.BOTH] },
        _id: { $ne: this._id },
      },
      { $set: { isDefault: false } }
    );
  }
});

const Address: Model<IAddress> =
  mongoose.models.Address ?? mongoose.model<IAddress>('Address', AddressSchema);

export default Address;
