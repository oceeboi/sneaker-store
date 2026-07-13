import mongoose, { Document, Model, Schema } from 'mongoose';
import { generateUniqueSlug } from '../utils/slug';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IBrand extends Document {
  name: string;
  slug: string;
  logo: string | null; // Cloudinary URL
  description: string | null;
  website: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const BrandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      maxlength: [100, 'Brand name cannot exceed 100 characters'],
    },

    slug: {
      type: String,
      unique: true,
      index: true,
      required: [true, 'Brand slug is required'],
      // Auto-generated from name on create; can be overridden by admin
    },

    logo: { type: String, default: null },
    description: { type: String, trim: true, default: null },
    website: { type: String, trim: true, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'brands',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

BrandSchema.index({ name: 1 });
BrandSchema.index({ active: 1, name: 1 });
BrandSchema.index({ active: 1, slug: 1 });

// ─── Pre-save: auto-generate slug ─────────────────────────────────────────────

BrandSchema.pre('validate', async function () {
  const should_generate_slug = (this.isNew || this.isModified('name')) && !this.isModified('slug');
  if (!should_generate_slug) return;

  const BrandModel = this.constructor as Model<IBrand>;
  this.slug = await generateUniqueSlug(BrandModel, this.name, this._id?.toString());
});

// ─── Model ────────────────────────────────────────────────────────────────────

const Brand: Model<IBrand> = mongoose.models.Brand ?? mongoose.model<IBrand>('Brand', BrandSchema);

export default Brand;
