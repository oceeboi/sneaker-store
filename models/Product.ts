import mongoose, { Document, Model, Schema } from 'mongoose';
import {
  Gender,
  IAdditionalSection,
  IDescription,
  IMedia,
  IPricing,
  ISeo,
  ISizeOption,
  MediaType,
  ProductType,
} from '../types/shared/product';
import { generateUniqueSlug } from '../utils/slug';

// ─── Interface ────────────────────────────────────────────────────────────────
// Product = the catalog item. NOT the purchasable unit (that is ProductVariant).
// "Nike Air Force 1 '07" is a Product.
// "Nike Air Force 1 '07 — Size 42, White" is a ProductVariant.

export interface IProduct extends Document {
  name: string;
  slug: string;
  brand: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  collections: mongoose.Types.ObjectId[]; // many-to-many via reference

  productType: ProductType;
  gender: Gender;

  description: IDescription;
  features: string[]; // bullet-point feature list

  media: IMedia[];
  sizes: ISizeOption[];
  pricing: IPricing;
  seo: ISeo;
  tags: string[];

  active: boolean;
  publishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const MediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true },
    alt: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(MediaType), default: MediaType.IMAGE },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const PricingSchema = new Schema<IPricing>(
  {
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    // Store in smallest unit (kobo for NGN, pence for GBP, cents for USD)
    // This avoids floating-point errors on monetary values entirely.
    basePrice: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    // Never exposed to the client — used internally for margin reporting
    costPrice: { type: Number, default: null, min: 0, select: false },
  },
  { _id: false }
);

const SizeOptionSchema = new Schema<ISizeOption>({
  size: { type: String, required: true, trim: true, maxlength: 20 },
  sku: { type: String, default: null, trim: true, maxlength: 120 },
  barcode: { type: String, default: null, trim: true, maxlength: 120 },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 0 },
  active: { type: Boolean, default: true },
});

const SeoSchema = new Schema<ISeo>(
  {
    title: { type: String, trim: true, default: null, maxlength: 70 },
    description: { type: String, trim: true, default: null, maxlength: 160 },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

const AdditionalSectionSchema = new Schema<IAdditionalSection>(
  {
    title: { type: String, required: true, trim: true, maxlength: 60 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const DescriptionSchema = new Schema<IDescription>(
  {
    narrative: {
      type: String,
      required: [true, 'A narrative description is required'],
      trim: true,
      maxlength: [2000, 'Narrative cannot exceed 2000 characters'],
    },
    styleCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      maxlength: 50,
    },
    colorway: {
      type: String,
      trim: true,
      default: null,
      maxlength: 150,
    },
    releaseDate: {
      type: Date,
      default: null,
    },
    materials: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    editorialHighlights: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 8,
        message: 'A product cannot have more than 8 editorial highlights',
      },
    },
    additionalSections: {
      type: [AdditionalSectionSchema],
      default: [],
      validate: {
        validator: (v: IAdditionalSection[]) => v.length <= 5,
        message: 'A product cannot have more than 5 additional sections',
      },
    },
  },
  { _id: false }
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },

    slug: {
      type: String,
      unique: true,
      index: true,
      required: [true, 'Product slug is required'],
      trim: true,
      lowercase: true,
    },

    brand: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand is required'],
      index: true,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },

    // Products reference collections — not the other way around.
    // This avoids 16 MB doc limit on large collections and keeps updates cheap.
    collections: {
      type: [Schema.Types.ObjectId],
      ref: 'Collection',
      default: [],
      index: true,
    },

    productType: {
      type: String,
      enum: Object.values(ProductType),
      required: [true, 'Product type is required'],
      index: true,
    },

    gender: {
      type: String,
      enum: Object.values(Gender),
      required: [true, 'Gender is required'],
      index: true,
    },

    description: {
      type: DescriptionSchema,
      required: [true, 'Description is required'],
    },
    features: { type: [String], default: [] },

    media: {
      type: [MediaSchema],
      default: [],
      validate: {
        validator: (v: IMedia[]) => v.length <= 20,
        message: 'A product cannot have more than 20 media items',
      },
    },

    sizes: {
      type: [SizeOptionSchema],
      default: [],
      validate: {
        validator: (v: ISizeOption[]) => {
          const normalized_sizes = v.map((item) => item.size.trim().toLowerCase());
          const has_unique_sizes = new Set(normalized_sizes).size === normalized_sizes.length;
          if (!has_unique_sizes) return false;

          return v.every((item) => item.reservedQuantity <= item.stockQuantity);
        },
        message: 'Product sizes must be unique and reserved stock cannot exceed total stock',
      },
    },

    pricing: {
      type: PricingSchema,
      required: [true, 'Pricing is required'],
    },

    seo: {
      type: SeoSchema,
      default: () => ({ title: null, description: null, keywords: [] }),
    },

    tags: {
      type: [String],
      default: [],
      index: true,
    },

    active: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'products',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Storefront filters — most common query combinations
ProductSchema.index({ category: 1, active: 1 });
ProductSchema.index({ brand: 1, active: 1 });
ProductSchema.index({ collections: 1, active: 1 });
ProductSchema.index({ gender: 1, active: 1 });
ProductSchema.index({ productType: 1, active: 1 });
ProductSchema.index({ tags: 1, active: 1 });

// Latest products feed
ProductSchema.index({ active: 1, publishedAt: -1 });

// Full-text search (MongoDB Atlas Search is preferred in production,
// but this covers basic text search without Atlas)
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

// ─── Pre-validate: auto-generate slug ────────────────────────────────────────

ProductSchema.pre('validate', async function () {
  const should_generate_slug = (this.isNew || this.isModified('name')) && !this.slug;
  if (!should_generate_slug) return;

  const ProductModel = this.constructor as Model<IProduct>;
  this.slug = await generateUniqueSlug(ProductModel, this.name, this._id?.toString());
});

// ─── Pre-save: publish timestamp ─────────────────────────────────────────────

ProductSchema.pre('save', function () {
  // Auto-set publishedAt when product goes live for the first time
  if (this.isModified('active') && this.active && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// ─── Virtual: variants ────────────────────────────────────────────────────────
// product.populate('variants') fetches all variants for this product.

ProductSchema.virtual('variants', {
  ref: 'ProductVariant',
  localField: '_id',
  foreignField: 'product',
});

// ─── Model ────────────────────────────────────────────────────────────────────

const Product: Model<IProduct> =
  mongoose.models.Product ?? mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
