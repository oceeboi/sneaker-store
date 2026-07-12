import { customAlphabet } from 'nanoid';

const numeric_id = customAlphabet('0123456789', 6);

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  return `ORD-${year}-${numeric_id()}`;
}

export function generateTxRef(): string {
  return `TXN-${Date.now()}-${numeric_id()}`;
}
