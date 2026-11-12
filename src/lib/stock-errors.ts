import { getApiErrorCode } from '@/lib/api-errors';

/**
 * The branch has less of a product left than the cart asks for (HTTP 409,
 * `data.productName`). Returned by add to cart, raising a quantity and payment
 * initialization. The cart is kept: the customer lowers the quantity or
 * removes the item, and the menu is refetched so `isSoldOut` is current.
 */
export const STOCK_ERROR_CODES = ['PRODUCT_SOLD_OUT', 'PRODUCT_QUANTITY_UNAVAILABLE'] as const;

export type StockErrorCode = (typeof STOCK_ERROR_CODES)[number];

export function isStockErrorCode(code: string | null | undefined): code is StockErrorCode {
  return !!code && (STOCK_ERROR_CODES as readonly string[]).includes(code);
}

export function isStockError(error: unknown): boolean {
  return isStockErrorCode(getApiErrorCode(error));
}
