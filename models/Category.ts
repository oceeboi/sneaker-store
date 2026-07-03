import mongoose, { Document, Model, Schema } from 'mongoose';
import { generateUniqueSlug } from '../utils/slug';

// ─── Interface ────────────────────────────────────────────────────────────────
// Self-referential: parent points to another Category.
// This supports unlimited nesting:
//   Footwear → Sneakers → Basketball

export interface ICategory extends Document {
  name: string;
  slug: string;
  parent: mongoose.Types.ObjectId | null; // null = root category
  image: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    // null = top-level root category
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },

    image: { type: String, default: null },
    description: { type: String, trim: true, default: null },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'categories',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

CategorySchema.index({ parent: 1, active: 1 });
CategorySchema.index({ sortOrder: 1 });
CategorySchema.index({ active: 1 });

// ─── Pre-save: auto-generate slug ─────────────────────────────────────────────

CategorySchema.pre('validate', async function () {
  const should_generate_slug = (this.isNew || this.isModified('name')) && !this.slug;
  if (!should_generate_slug) return;

  const CategoryModel = this.constructor as Model<ICategory>;
  this.slug = await generateUniqueSlug(CategoryModel, this.name, this._id?.toString());
});

// ─── Virtual: children ────────────────────────────────────────────────────────
// Allows category.populate('children') to get sub-categories.

CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

// ─── Model ────────────────────────────────────────────────────────────────────

const Category: Model<ICategory> =
  mongoose.models.Category ?? mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
