import { describe, expect, it } from 'vitest';
import { resolveOrderTypeSettings, resolvePaymentSettings, type Branch } from './branch';

const branch = (overrides: Partial<Branch>): Branch => ({
  id: 'branch-1',
  name: 'Artisan Pizza House Crest #088',
  addressText: '',
  deliveryRadiusM: 5000,
  locationGeog: { type: 'Point', coordinates: [28.9784, 41.0082] },
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  countryCode: 'TR',
  province: '',
  district: '',
  neighborhood: '',
  street: '',
  buildingNumber: null,
  apartmentNumber: null,
  postalCode: null,
  isActive: true,
  ...overrides,
});

/**
 * The payloads below are trimmed copies of live `api.runmeal.com` responses.
 * Only the nearby search flattens the settings to the top level; every other
 * branch route leaves them in `parameters`, which is what makes the resolvers
 * necessary at all.
 */
describe('branch settings resolvers', () => {
  const orderTypes = {
    pickup: { isActive: false },
    delivery: { isActive: true },
    tableOrder: { isActive: false },
    scheduledPickup: { isActive: false },
    scheduledDelivery: { isActive: true },
  };

  it('reads order types out of parameters, as GET /branches/:id sends them', () => {
    const resolved = resolveOrderTypeSettings(branch({ parameters: { order_type_settings: orderTypes } }));
    expect(resolved?.delivery?.isActive).toBe(true);
    expect(resolved?.pickup?.isActive).toBe(false);
  });

  it('prefers the flattened copy the nearby search sends', () => {
    const resolved = resolveOrderTypeSettings(branch({ order_type_settings: orderTypes }));
    expect(resolved?.scheduledDelivery?.isActive).toBe(true);
  });

  it('reports no settings at all rather than "everything off"', () => {
    // A branch predating the setting still takes delivery orders.
    expect(resolveOrderTypeSettings(branch({}))).toBeNull();
    expect(resolvePaymentSettings(branch({}))).toBeNull();
  });

  it('treats the nearby search empty-array payment payload as absence', () => {
    // The endpoint always sends the key, with `[]` inside when nothing is set.
    const resolved = resolvePaymentSettings(
      branch({ payment_settings: { onlineMethods: [], offlineMethods: [] } }),
    );
    expect(resolved).toBeNull();
  });

  it('falls back to parameters when the flattened payment copy is empty', () => {
    const resolved = resolvePaymentSettings(
      branch({
        payment_settings: { onlineMethods: [], offlineMethods: [] },
        parameters: { payment_settings: { offlineMethods: { cash: { isActive: true } } } },
      }),
    );
    expect(resolved?.offlineMethods?.cash?.isActive).toBe(true);
  });

  it('keeps a real flattened payment payload', () => {
    const resolved = resolvePaymentSettings(
      branch({ payment_settings: { onlineMethods: { card: { isActive: true, provider: 'iyzico' } } } }),
    );
    expect(resolved?.onlineMethods?.card?.isActive).toBe(true);
  });
});
