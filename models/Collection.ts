import mongoose, { Document, Model, Schema } from 'mongoose';
import { CollectionType } from '../types/shared/product';
import { generateUniqueSlug } from '../utils/slug';

// ─── Smart collection rule ────────────────────────────────────────────────────
// "Smart" collections auto-populate based on rules evaluated at query time.
// e.g. { field: "tags", operator: "contains", value: "new-arrivals" }

export interface ICollectionRule {
  field: string; // "tags" | "brand" | "category" | "gender" | "productType"
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
}

// ─── Interface ────────────────────────────────────────────────────────────────
// NOTE: No products array here.
// Products reference Collections via Product.collections[].
// This avoids the 16 MB MongoDB document limit on large collections.

export interface ICollection extends Document {
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  active: boolean;
  type: CollectionType;
  rules: ICollectionRule[]; // only used when type === 'smart'
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schema ───────────────────────────────────────────────────────────────

const CollectionRuleSchema = new Schema<ICollectionRule>(
  {
    field: {
      type: String,
      required: true,
      enum: ['tags', 'brand', 'category', 'gender', 'productType'],
    },
    operator: {
      type: String,
      required: true,
      enum: ['equals', 'contains', 'greater_than', 'less_than'],
    },
    value: { type: String, required: true },
  },
  { _id: false } // embedded — no separate _id needed
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const CollectionSchema = new Schema<ICollection>(
  {
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: [100, 'Collection name cannot exceed 100 characters'],
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    description: { type: String, trim: true, default: null },
    bannerImage: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },

    type: {
      type: String,
      enum: Object.values(CollectionType),
      default: CollectionType.MANUAL,
    },

    // Only populated when type === 'smart'
    rules: {
      type: [CollectionRuleSchema],
      default: [],
    },

    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'collections',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

CollectionSchema.index({ active: 1, sortOrder: 1 });

// ─── Pre-save: auto-generate slug ─────────────────────────────────────────────

CollectionSchema.pre('validate', async function () {
  const should_generate_slug = (this.isNew || this.isModified('name')) && !this.isModified('slug');
  if (!should_generate_slug) return;

  const CollectionModel = this.constructor as Model<ICollection>;
  this.slug = await generateUniqueSlug(CollectionModel, this.name, this._id?.toString());
});

// ─── Model ────────────────────────────────────────────────────────────────────

const Collection: Model<ICollection> =
  mongoose.models.Collection ?? mongoose.model<ICollection>('Collection', CollectionSchema);

export default Collection;
