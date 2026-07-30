import { describe, expect, it } from 'vitest';

import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  getLoyaltyErrorTranslationKey,
  isCartStaleLoyaltyError,
  isLoyaltyError,
  resolveLoyaltyErrorMessage,
  resolveUnapplicableReason,
} from './loyalty-errors';

const apiError = (
  code: string | undefined,
  message: string | string[] = 'Promotion conditions are not met for this cart',
  status = 400,
) => ({
  response: {
    status,
    data: {
      status: false,
      message,
      code,
      statusCode: status,
      data: { provider: 'REKONECT', assetKey: 'U4OfQui9KLHxDcuFq37t' },
    },
  },
});

// Translation stub that echoes the key, so assertions read as key lookups.
const translate = (key: string) => `t:${key}`;

describe('loyalty error helpers', () => {
  it('reads the machine readable code, never the message text', () => {
    expect(getApiErrorCode(apiError('LOYALTY_PROMOTION_NOT_APPLICABLE'))).toBe(
      'LOYALTY_PROMOTION_NOT_APPLICABLE',
    );
    expect(getApiErrorCode(apiError(undefined))).toBeUndefined();
    expect(getApiErrorCode(new Error('boom'))).toBeUndefined();
  });

  it('exposes the HTTP status', () => {
    expect(getApiErrorStatus(apiError('LOYALTY_PROMOTION_INACTIVE', 'nope', 401))).toBe(401);
    expect(getApiErrorStatus(undefined)).toBeUndefined();
  });

  it.each([
    'LOYALTY_PROMOTION_NOT_APPLICABLE',
    'LOYALTY_PROMOTION_NOT_OWNED',
    'LOYALTY_PROMOTION_INACTIVE',
    'LOYALTY_PROMOTIONS_NOT_COMBINABLE',
    'LOYALTY_PROMOTION_NOT_FOUND_ON_CART',
    'LOYALTY_PROMOTION_NO_LONGER_APPLICABLE',
    'LOYALTY_EXTERNAL_PROVIDER_NOT_ACTIVE',
  ])('maps %s to a dedicated translation key', (code) => {
    expect(getLoyaltyErrorTranslationKey(code)).toBe(`cart.loyalty.errors.${code}`);
    expect(resolveLoyaltyErrorMessage(apiError(code), translate, 'cart.loyalty.toast.applyFailed')).toBe(
      `t:cart.loyalty.errors.${code}`,
    );
  });

  it('falls back to the backend message for unmapped codes', () => {
    const error = apiError('SOME_OTHER_CODE', 'Backend explanation');

    expect(getLoyaltyErrorTranslationKey('SOME_OTHER_CODE')).toBeNull();
    expect(resolveLoyaltyErrorMessage(error, translate, 'cart.loyalty.toast.applyFailed')).toBe(
      'Backend explanation',
    );
  });

  it('falls back to the generic key when there is no message at all', () => {
    expect(resolveLoyaltyErrorMessage({}, translate, 'cart.loyalty.toast.applyFailed')).toBe(
      't:cart.loyalty.toast.applyFailed',
    );
  });

  it('never surfaces the technical provider payload', () => {
    const message = resolveLoyaltyErrorMessage(
      apiError('LOYALTY_PROMOTION_NOT_APPLICABLE'),
      translate,
      'cart.loyalty.toast.applyFailed',
    );

    expect(message).not.toContain('REKONECT');
    expect(message).not.toContain('assetKey');
  });

  it('joins array messages', () => {
    expect(getApiErrorMessage(apiError('X', ['first', 'second']), 'fallback')).toBe('first second');
  });

  it('flags only the cart-changed code as stale', () => {
    expect(isCartStaleLoyaltyError(apiError('LOYALTY_PROMOTION_NO_LONGER_APPLICABLE'))).toBe(true);
    expect(isCartStaleLoyaltyError(apiError('LOYALTY_PROMOTION_NOT_APPLICABLE'))).toBe(false);
    expect(isCartStaleLoyaltyError(new Error('network'))).toBe(false);
  });

  it('recognises loyalty errors coming back from checkout validation', () => {
    expect(isLoyaltyError(apiError('LOYALTY_PROMOTIONS_NOT_COMBINABLE'))).toBe(true);
    expect(isLoyaltyError(apiError('PAYMENT_FAILED'))).toBe(false);
  });

  it('maps a known unapplicable reason and passes unknown ones straight through', () => {
    const mapped = (key: string) =>
      key === 'cart.loyalty.unapplicableReasons.ALREADY_USED' ? 'Bu kupon daha önce kullanılmış.' : key;

    expect(resolveUnapplicableReason('ALREADY_USED', mapped)).toBe('Bu kupon daha önce kullanılmış.');
    expect(resolveUnapplicableReason('MIN_BASKET_NOT_REACHED', mapped)).toBe('MIN_BASKET_NOT_REACHED');
    expect(resolveUnapplicableReason(null, mapped)).toBeNull();
  });
});
