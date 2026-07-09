export interface ICartItem {
  product: string; // ObjectId as string
  sizeId: string; // ObjectId as string
  size: string;
  sku: string;
  quantity: number;
  priceAtAdd: number;
}

export interface ICart {
  user: string; // ObjectId as string
  items: ICartItem[];
  currency: string;
  lastActivityAt: Date;
  status: 'active' | 'converted' | 'abandoned';
}
