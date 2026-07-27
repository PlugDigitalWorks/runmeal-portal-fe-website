import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/axios';
import { cartService } from './cart.service';

vi.mock('@/lib/axios', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

const cartResponse = {
  data: {
    data: {
      cartId: 'cart-1',
      totalCartPrice: 270,
      discountAmount: 89,
      finalPrice: 181,
      appliedPromotions: [{ id: 'promo-1', name: 'Kampanya', externalProvider: 'REKONECT' }],
      items: [],
    },
  },
};

describe('cartService external promotions', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
  });

  it('lists available promotions for the cart and order type', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [{ applicable: true, promotion: { id: 'p1' } }] } });

    const result = await cartService.getAvailablePromotions('cart-1', 'DELIVERY');

    expect(mockedApi.get).toHaveBeenCalledWith('/carts/cart-1/promotions/available', {
      params: { orderType: 'DELIVERY' },
    });
    expect(result).toHaveLength(1);
  });

  it('returns an empty list rather than undefined when the API sends nothing', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });

    await expect(cartService.getAvailablePromotions('cart-1')).resolves.toEqual([]);
  });

  it('applies an external promotion with the promotion id as assetKey', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    const cart = await cartService.applyExternalPromotion('cart-1', 'U4OfQui9KLHxDcuFq37t');

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/apply-external-promotion', {
      assetKey: 'U4OfQui9KLHxDcuFq37t',
      orderType: 'DELIVERY',
    });
    expect(cart.finalPrice).toBe(181);
    expect(cart.appliedPromotions).toHaveLength(1);
  });

  it('removes a single external promotion by assetKey', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    await cartService.removeExternalPromotion('cart-1', 'asset-9');

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/remove-external-promotion', {
      assetKey: 'asset-9',
    });
  });

  it('removes every external promotion when no assetKey is given', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    await cartService.removeExternalPromotion('cart-1');

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/remove-external-promotion', {});
  });
});
