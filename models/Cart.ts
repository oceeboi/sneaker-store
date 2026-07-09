import { Schema } from 'mongoose';
import mongoose, { Model } from 'mongoose';

/**
 * @author Oghenekevwe Osieta <oceeboy>
 * note: Cart is a temporary storage for items that a user intends to purchase. It is not a permanent record of purchases. When a user completes a purchase, the items in the cart are converted into an order and the cart is cleared.
 * The cart is also used to track abandoned carts. If a user adds items to their cart but does not complete the purchase, the cart is marked as abandoned after a certain period of inactivity. This allows the system to send reminders or offers to the user to encourage them to complete their purchase.
 * reason for using user instead of sessionId: The cart is tied to a user account rather than a session. This allows users to access their cart from any device or browser as long as they are logged in. It also allows for better tracking of user behavior and preferences.
 * user and not UserId cause i want to use the ObjectId type from mongoose.Types.ObjectId for better type safety and to leverage Mongoose's built-in features for handling ObjectIds. This ensures that the user field is always a valid ObjectId, which is important for maintaining data integrity and consistency in the database.
 */

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  sizeId: mongoose.Types.ObjectId;
  size: string;
  sku: string;
  quantity: number;
  priceAtAdd: number;
}

export interface ICart extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  currency: string;
  lastActivityAt: Date;
  status: 'active' | 'converted' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sizeId: { type: Schema.Types.ObjectId, required: true }, // stable ref to the size subdocument
    size: { type: String, required: true }, // snapshot for display — "what the customer saw"
    sku: { type: String, required: true }, // snapshot
    quantity: { type: Number, required: true, min: 1 },
    priceAtAdd: { type: Number, required: true },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [CartItemSchema], default: [] },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true }, // key for abandoned-cart tracking
    status: {
      type: String,
      enum: ['active', 'converted', 'abandoned'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

const Cart: Model<ICart> = mongoose.models.Cart ?? mongoose.model<ICart>('Cart', CartSchema);

export default Cart;
