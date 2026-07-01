import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserProfile extends Document {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerified: boolean;
  avatar: string | null; // Cloudinary URL
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  referralId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one profile per user
      index: true,
    },
    firstName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    avatar: {
      type: String,
      default: null, // Cloudinary URL
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: null,
    },
    referralId: {
      type: Schema.Types.ObjectId,
      ref: 'Referral',
      required: true,
      unique: true, // one profile per user
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      unique: true, // one profile per user
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'user_profiles',
  }
);

const UserProfile: Model<IUserProfile> =
  mongoose.models.UserProfile ?? mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);

export default UserProfile;
