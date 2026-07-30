import { describe, expect, it } from 'vitest';

import en from './locales/en/common.json';
import tr from './locales/tr/common.json';
import { LOYALTY_ERROR_CODES } from '@/lib/loyalty-errors';

const locales = { en, tr } as const;

const readKey = (source: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object') {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);

const REQUIRED_KEYS = [
  'cart.loyalty.title',
  'cart.loyalty.providers.INTERNAL',
  'cart.loyalty.providers.REKONECT',
  'cart.loyalty.apply',
  'cart.loyalty.remove',
  'cart.loyalty.removeAll',
  'cart.loyalty.empty',
  'cart.loyalty.loadError',
  'cart.loyalty.retry',
  'cart.loyalty.conditionsHint',
  'cart.loyalty.couponPlaceholder',
  'cart.loyalty.unapplicableReasons.ALREADY_USED',
  'cart.loyalty.toast.applied',
  'cart.loyalty.toast.applyFailed',
  'cart.loyalty.toast.removed',
  'cart.loyalty.toast.removeFailed',
  'cart.discount',
  'cart.finalTotal',
  'checkout.promotionsChanged.title',
  'checkout.promotionsChanged.description',
  'checkout.promotionsChanged.confirm',
  ...LOYALTY_ERROR_CODES.map((code) => `cart.loyalty.errors.${code}`),
];

describe.each(Object.entries(locales))('%s loyalty translations', (_locale, bundle) => {
  it.each(REQUIRED_KEYS)('defines %s', (key) => {
    const value = readKey(bundle as unknown as Record<string, unknown>, key);
    expect(typeof value).toBe('string');
    expect(value).not.toBe('');
  });
});
