import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/axios';
import { LoyaltyProviderType } from '@/types/cart';
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
      appliedPromotions: [
        { type: LoyaltyProviderType.REKONECT, promotionCode: 'fnftNQHm1VH42bjNlOZ2', name: 'Kampanya' },
      ],
      items: [],
    },
  },
};

describe('cartService promotions', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
  });

  it('lists available promotions for the cart and order type', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [{ type: LoyaltyProviderType.REKONECT, promotionCode: 'p1', applicable: true }] },
    });

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

  it('applies a Rekonect campaign by echoing back type and promotionCode', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    const cart = await cartService.applyPromotion('cart-1', {
      type: LoyaltyProviderType.REKONECT,
      promotionCode: 'fnftNQHm1VH42bjNlOZ2',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/promotions/apply', {
      type: 'REKONECT',
      promotionCode: 'fnftNQHm1VH42bjNlOZ2',
      orderType: 'DELIVERY',
    });
    expect(cart.finalPrice).toBe(181);
    expect(cart.appliedPromotions).toHaveLength(1);
  });

  it('applies an internal coupon through the very same endpoint', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    await cartService.applyPromotion('cart-1', {
      type: LoyaltyProviderType.INTERNAL,
      promotionCode: 'WELCOME10',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/promotions/apply', {
      type: 'INTERNAL',
      promotionCode: 'WELCOME10',
      orderType: 'DELIVERY',
    });
  });

  it('removes a single promotion by its code', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    await cartService.removePromotion('cart-1', {
      type: LoyaltyProviderType.REKONECT,
      promotionCode: 'asset-9',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/promotions/remove', {
      type: 'REKONECT',
      promotionCode: 'asset-9',
    });
  });

  it('removes every promotion of a provider when no code is given', async () => {
    mockedApi.post.mockResolvedValue(cartResponse);

    await cartService.removePromotion('cart-1', { type: LoyaltyProviderType.REKONECT });

    expect(mockedApi.post).toHaveBeenCalledWith('/carts/cart-1/promotions/remove', {
      type: 'REKONECT',
    });
  });
});
