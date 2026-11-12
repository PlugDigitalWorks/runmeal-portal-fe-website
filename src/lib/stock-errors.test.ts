import { describe, expect, it } from 'vitest';
import { isStockError, isStockErrorCode } from './stock-errors';

const apiError = (code: string) => ({
  response: { status: 409, data: { code, statusCode: 409, data: { productName: 'Ayran' } } },
});

describe('stock errors', () => {
  it('recognises both shortage codes', () => {
    expect(isStockError(apiError('PRODUCT_SOLD_OUT'))).toBe(true);
    expect(isStockError(apiError('PRODUCT_QUANTITY_UNAVAILABLE'))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isStockError(apiError('CART_NOT_FOUND'))).toBe(false);
    expect(isStockError(new Error('network'))).toBe(false);
    expect(isStockErrorCode(null)).toBe(false);
  });
});
