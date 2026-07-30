import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CartPromotions } from './CartPromotions';
import {
  LoyaltyProviderType,
  type ApplyPromotionInput,
  type CartPromotion,
  type RemovePromotionInput,
} from '@/types/cart';

const stable = vi.hoisted(() => ({
  translation: { t: (key: string) => key },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
}));

const cartApi = vi.hoisted(() => ({
  availablePromotionsByCart: {} as Record<string, CartPromotion[]>,
  promotionsVersion: 0,
  loadAvailablePromotions: vi.fn<(cartId: string) => Promise<void>>(),
  invalidateAvailablePromotions: vi.fn<() => void>(),
  isPromotionsLoading: vi.fn<(cartId: string) => boolean>(),
  hasPromotionsError: vi.fn<(cartId: string) => boolean>(),
  applyPromotion: vi.fn<(cartId: string, input: ApplyPromotionInput) => Promise<boolean>>(),
  removePromotion: vi.fn<(cartId: string, input: RemovePromotionInput) => Promise<boolean>>(),
  isPromotionPending: vi.fn<(cartId: string, input: RemovePromotionInput) => boolean>(),
}));

vi.mock('@/context/CartContext', () => ({
  useCart: () => cartApi,
}));

const CART_ID = 'cart-1';

const promotion = (
  promotionCode: string,
  overrides: Partial<CartPromotion> = {},
): CartPromotion => ({
  type: LoyaltyProviderType.REKONECT,
  promotionCode,
  name: `Kampanya ${promotionCode}`,
  description: `Açıklama ${promotionCode}`,
  creditType: 'gift',
  creditValue: 0,
  imageUrl: null,
  applicable: true,
  unapplicableReason: null,
  ...overrides,
});

const internal = (promotionCode = 'WELCOME10', overrides: Partial<CartPromotion> = {}) =>
  promotion(promotionCode, {
    type: LoyaltyProviderType.INTERNAL,
    name: 'Runmeal Kuponu',
    description: 'Dahili kampanya',
    ...overrides,
  });

describe('<CartPromotions />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartApi.availablePromotionsByCart = {};
    cartApi.promotionsVersion = 0;
    cartApi.loadAvailablePromotions.mockResolvedValue(undefined);
    cartApi.applyPromotion.mockResolvedValue(true);
    cartApi.removePromotion.mockResolvedValue(true);
    cartApi.isPromotionsLoading.mockReturnValue(false);
    cartApi.hasPromotionsError.mockReturnValue(false);
    cartApi.isPromotionPending.mockReturnValue(false);
  });

  it('loads the promotion list once the cart id exists', async () => {
    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledWith(CART_ID));
  });

  it('lists both providers in the same list', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [promotion('promo-a'), internal()] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('Kampanya promo-a')).toBeInTheDocument();
    expect(screen.getByText('Runmeal Kuponu')).toBeInTheDocument();
  });

  it('shows apply for unapplied promotions and remove for applied ones', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [promotion('promo-a'), promotion('promo-b')] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[promotion('promo-a')]} />);

    expect(screen.getAllByText('cart.loyalty.remove')).toHaveLength(1);
    expect(screen.getAllByText('cart.loyalty.apply')).toHaveLength(1);

    fireEvent.click(screen.getByText('cart.loyalty.apply'));
    expect(cartApi.applyPromotion).toHaveBeenCalledWith(CART_ID, {
      type: LoyaltyProviderType.REKONECT,
      promotionCode: 'promo-b',
    });

    fireEvent.click(screen.getByText('cart.loyalty.remove'));
    expect(cartApi.removePromotion).toHaveBeenCalledWith(CART_ID, {
      type: LoyaltyProviderType.REKONECT,
      promotionCode: 'promo-a',
    });
  });

  it('removes an applied internal coupon per provider, without a code', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[internal()]} />);

    fireEvent.click(screen.getByText('cart.loyalty.remove'));
    expect(cartApi.removePromotion).toHaveBeenCalledWith(CART_ID, {
      type: LoyaltyProviderType.INTERNAL,
    });
  });

  it('keeps an applied promotion removable after it drops out of the candidate list', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [promotion('promo-b')] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[promotion('promo-a')]} />);

    expect(screen.getByText('Kampanya promo-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('cart.loyalty.remove'));
    expect(cartApi.removePromotion).toHaveBeenCalledWith(CART_ID, {
      type: LoyaltyProviderType.REKONECT,
      promotionCode: 'promo-a',
    });
  });

  it('disables only the control whose mutation is in flight', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [promotion('promo-a'), promotion('promo-b')] };
    cartApi.isPromotionPending.mockImplementation(
      (_cartId, input) => input.promotionCode === 'promo-a',
    );

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    const [firstButton, secondButton] = screen.getAllByRole('button', { name: /cart.loyalty.apply/ });
    expect(firstButton).toBeDisabled();
    expect(secondButton).toBeEnabled();
  });

  it('offers a bulk remove only when more than one Rekonect campaign is applied', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };

    const { rerender } = render(<CartPromotions cartId={CART_ID} appliedPromotions={[promotion('promo-a')]} />);
    expect(screen.queryByText('cart.loyalty.removeAll')).not.toBeInTheDocument();

    rerender(
      <CartPromotions cartId={CART_ID} appliedPromotions={[promotion('promo-a'), promotion('promo-b')]} />,
    );
    fireEvent.click(screen.getByText('cart.loyalty.removeAll'));

    expect(cartApi.removePromotion).toHaveBeenCalledWith(CART_ID, {
      type: LoyaltyProviderType.REKONECT,
    });
  });

  it('renders a quiet empty state instead of an error when there are no promotions', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('cart.loyalty.empty')).toBeInTheDocument();
    expect(screen.queryByText('cart.loyalty.loadError')).not.toBeInTheDocument();
  });

  it('offers a retry when the list could not be loaded', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };
    cartApi.hasPromotionsError.mockReturnValue(true);

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('cart.loyalty.loadError')).toBeInTheDocument();
    fireEvent.click(screen.getByText('cart.loyalty.retry'));
    expect(cartApi.loadAvailablePromotions).toHaveBeenCalledWith(CART_ID);
  });

  it('shows a skeleton while the first load is in flight', () => {
    cartApi.isPromotionsLoading.mockReturnValue(true);

    const { container } = render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    expect(screen.queryByText('cart.loyalty.empty')).not.toBeInTheDocument();
  });

  it('lists an unapplicable promotion with its reason and a disabled apply button', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [promotion('promo-a', { applicable: false, unapplicableReason: 'ALREADY_USED' })],
    };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('Kampanya promo-a')).toBeInTheDocument();
    // The identity `t` mock has no mapped copy, so the raw backend reason shows.
    expect(screen.getByText('ALREADY_USED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cart.loyalty.apply/ })).toBeDisabled();
  });

  it('falls back to a generic hint when no reason is given', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [promotion('promo-a', { applicable: false })],
    };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('cart.loyalty.conditionsHint')).toBeInTheDocument();
  });

  it('applies a hand typed code as an internal coupon', async () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} allowCouponCode />);

    fireEvent.change(screen.getByPlaceholderText('cart.loyalty.couponPlaceholder'), {
      target: { value: 'welcome10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cart.loyalty.apply/ }));

    await waitFor(() =>
      expect(cartApi.applyPromotion).toHaveBeenCalledWith(CART_ID, {
        type: LoyaltyProviderType.INTERNAL,
        promotionCode: 'welcome10',
      }),
    );
  });

  it('hides the coupon field unless the host asks for it', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.queryByPlaceholderText('cart.loyalty.couponPlaceholder')).not.toBeInTheDocument();
  });

  it('refetches when the cached lists are invalidated', async () => {
    const { rerender } = render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);
    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledTimes(1));

    cartApi.promotionsVersion = 1;
    rerender(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledTimes(2));
  });
});
