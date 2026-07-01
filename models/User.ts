import mongoose, { Document, Model, Schema } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────
// Keeping enums as const objects gives us runtime values AND TypeScript types
// from a single source of truth — no duplication.

export const UserRole = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPPORT: 'support', // will have limited access to user data for support purposes, but no write permissions
  MODERATOR: 'moderator', // can manage user-generated content but not user accounts
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  PENDING: 'pending', // registered, email not yet verified
  ACTIVE: 'active', // email verified, can trade
  SUSPENDED: 'suspended', // compliance hold
  LOCKED: 'locked', // too many failed logins
  CLOSED: 'closed', // account closed
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// ─── Document interface ────────────────────────────────────────────────────────
// The User model owns authentication ONLY.
// Personal info  → UserProfile
// KYC            → KycProfile

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: UserRole;
  status: UserStatus;
  // refresh token is stored hashed so a stolen DB dump can't be replayed
  refreshTokenHash: string | null;
  // email verification / password-reset tokens are stored hashed too
  emailVerifyTokenHash: string | null;
  emailVerifyTokenExp: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetTokenExp: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────────
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
      match: [/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'],
    },

    passwordHash: {
      type: String,
      required: true,
      // never return this field in API responses — set select: false so it must
      // be explicitly requested with .select("+passwordHash")
      select: false,
    },

    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },

    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING,
    },

    // ── Token storage (always hashed, never plain) ──────────────────────────
    refreshTokenHash: { type: String, default: null, select: false },
    emailVerifyTokenHash: { type: String, default: null, select: false },
    emailVerifyTokenExp: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetTokenExp: { type: Date, default: null },

    // ── Security counters ───────────────────────────────────────────────────
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    versionKey: false, // removes __v
    collection: 'users',
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// Compound sparse index — fast lookup during password-reset flow
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
UserSchema.index({ emailVerifyTokenHash: 1 }, { sparse: true });

// ─── Model ────────────────────────────────────────────────────────────────────
// Guard against model recompilation in Next.js hot-reload
const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);

export default User;
