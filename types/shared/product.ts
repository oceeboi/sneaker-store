// ─── Shared enums ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

export const ProductType = {
  SNEAKER: 'sneaker', // footwear
  APPAREL: 'apparel', // clothing
  ACCESSORY: 'accessory', // bags, hats, jewelry, etc.
  EQUIPMENT: 'equipment', // sports gear, electronics, etc.
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const Gender = {
  MEN: 'men',
  WOMEN: 'women',
  UNISEX: 'unisex',
  KIDS: 'kids',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const MediaType = {
  IMAGE: 'image', // photos, illustrations, etc.
  VIDEO: 'video', // mp4, webm, etc.
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const CollectionType = {
  MANUAL: 'manual', // admin hand-picks products
  SMART: 'smart', // rule-based (e.g. tag = "new-arrivals")
} as const;
export type CollectionType = (typeof CollectionType)[keyof typeof CollectionType];

export const InventoryMovementReason = {
  PURCHASE: 'purchase', // customer bought
  RESTOCK: 'restock', // new stock added
  RETURN: 'return', // customer returned
  DAMAGED: 'damaged', // written off
  ADJUSTMENT: 'adjustment', // manual correction
  RESERVATION: 'reservation', // held for pending order
  CANCELLATION: 'cancellation', // reservation released
} as const;
export type InventoryMovementReason =
  (typeof InventoryMovementReason)[keyof typeof InventoryMovementReason];

// ─── Reusable sub-document types ──────────────────────────────────────────────

export interface IMedia {
  url: string;
  alt: string;
  type: MediaType;
  order: number;
}
export interface IDescription {
  narrative: string; // the editorial paragraph — brand story, collab context, design details
  styleCode: string | null; // e.g. "IM9113-300" — the manufacturer's official style/reference code
  colorway: string | null; // e.g. "Green Spark / Black / Vapor Green"
  releaseDate: Date | null; // e.g. March 28, 2026
  materials: string | null; // optional — "Green Spark leather, black nubuck accents"
  editorialHighlights: string[]; // short scannable design callouts, e.g. "Reverse Swoosh", "Cactus Jack branding"
  additionalSections: IAdditionalSection[];
}
export interface IAdditionalSection {
  title: string; // e.g. "Authenticity", "Packaging", "Sizing Guide"
  content: string;
}

export interface IPricing {
  currency: string; // ISO 4217 e.g. "NGN"
  basePrice: number; // in the smallest unit (kobo for NGN)
  compareAtPrice: number | null; // crossed-out "was" price
  costPrice: number | null; // internal margin tracking, never exposed to client
}

export interface ISeo {
  title: string | null;
  description: string | null;
  keywords: string[];
}

export interface ISizeOption {
  size: string; // e.g. "40", "41", "M", "L"
  sku: string | null; // optional size-specific SKU
  barcode: string | null; // optional GTIN/EAN/UPC
  stockQuantity: number; // available quantity for this size
  reservedQuantity: number; // quantity reserved by unpaid/pending orders
  reorderLevel: number; // low-stock threshold for admin alerts
  active: boolean; // disable specific size without deleting it
  _id?: mongoose.Types.ObjectId; // optional — only present if this is a subdocument in a Product
}

export interface IProductAttributes {
  [key: string]: string;
  // e.g. { size: "42", color: "White", material: "Leather" }
  // Generic so the same variant schema works for sneakers, shirts, bags, etc.
}

export interface IDimensions {
  length: number; // cm
  width: number;
  height: number;
}
