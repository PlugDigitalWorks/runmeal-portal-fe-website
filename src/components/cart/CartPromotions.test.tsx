import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CartPromotions } from './CartPromotions';
import type { AppliedPromotion, AvailablePromotion } from '@/types/cart';

const stable = vi.hoisted(() => ({
  translation: { t: (key: string) => key },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
}));

const cartApi = vi.hoisted(() => ({
  availablePromotionsByCart: {} as Record<string, AvailablePromotion[]>,
  promotionsVersion: 0,
  loadAvailablePromotions: vi.fn<(cartId: string) => Promise<void>>(),
  invalidateAvailablePromotions: vi.fn<() => void>(),
  isPromotionsLoading: vi.fn<(cartId: string) => boolean>(),
  hasPromotionsError: vi.fn<(cartId: string) => boolean>(),
  applyExternalPromotion: vi.fn<(cartId: string, assetKey: string) => Promise<boolean>>(),
  removeExternalPromotion: vi.fn<(cartId: string, assetKey?: string) => Promise<boolean>>(),
  isPromotionPending: vi.fn<(cartId: string, assetKey?: string) => boolean>(),
}));

vi.mock('@/context/CartContext', () => ({
  useCart: () => cartApi,
}));

const CART_ID = 'cart-1';

const rekonectCandidate = (id: string, overrides: Partial<AvailablePromotion> = {}): AvailablePromotion => ({
  applicable: true,
  promotion: {
    id,
    name: `Kampanya ${id}`,
    description: `Açıklama ${id}`,
    creditType: 'gift',
    creditValue: 0,
    externalProvider: 'REKONECT',
    status: 'active',
    raw: {},
  },
  ...overrides,
});

const internalCandidate = (): AvailablePromotion => ({
  applicable: true,
  promotion: {
    id: 'internal-1',
    name: 'Runmeal Kuponu',
    description: 'Dahili kampanya',
    couponCode: 'WELCOME10',
    externalProvider: null,
  },
});

const applied = (id: string): AppliedPromotion => ({
  id,
  name: `Kampanya ${id}`,
  description: 'Açıklama',
  creditType: 'gift',
  creditValue: 50,
  externalProvider: 'REKONECT',
});

describe('<CartPromotions />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartApi.availablePromotionsByCart = {};
    cartApi.promotionsVersion = 0;
    cartApi.loadAvailablePromotions.mockResolvedValue(undefined);
    cartApi.applyExternalPromotion.mockResolvedValue(true);
    cartApi.removeExternalPromotion.mockResolvedValue(true);
    cartApi.isPromotionsLoading.mockReturnValue(false);
    cartApi.hasPromotionsError.mockReturnValue(false);
    cartApi.isPromotionPending.mockReturnValue(false);
  });

  it('loads the campaign list once the cart id exists', async () => {
    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledWith(CART_ID));
  });

  it('lists only Rekonect campaigns and ignores internal Runmeal coupons', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [rekonectCandidate('promo-a'), internalCandidate()],
    };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('Kampanya promo-a')).toBeInTheDocument();
    expect(screen.getByText('Açıklama promo-a')).toBeInTheDocument();
    expect(screen.queryByText('Runmeal Kuponu')).not.toBeInTheDocument();
  });

  it('shows apply for unapplied campaigns and remove for applied ones', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [rekonectCandidate('promo-a'), rekonectCandidate('promo-b')],
    };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[applied('promo-a')]} />);

    expect(screen.getAllByText('cart.loyalty.remove')).toHaveLength(1);
    expect(screen.getAllByText('cart.loyalty.apply')).toHaveLength(1);

    fireEvent.click(screen.getByText('cart.loyalty.apply'));
    expect(cartApi.applyExternalPromotion).toHaveBeenCalledWith(CART_ID, 'promo-b');

    fireEvent.click(screen.getByText('cart.loyalty.remove'));
    expect(cartApi.removeExternalPromotion).toHaveBeenCalledWith(CART_ID, 'promo-a');
  });

  it('keeps an applied campaign removable after it drops out of the candidate list', () => {
    cartApi.availablePromotionsByCart = { [CART_ID]: [rekonectCandidate('promo-b')] };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[applied('promo-a')]} />);

    expect(screen.getByText('Kampanya promo-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('cart.loyalty.remove'));
    expect(cartApi.removeExternalPromotion).toHaveBeenCalledWith(CART_ID, 'promo-a');
  });

  it('disables only the control whose mutation is in flight', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [rekonectCandidate('promo-a'), rekonectCandidate('promo-b')],
    };
    cartApi.isPromotionPending.mockImplementation((_cartId, assetKey) => assetKey === 'promo-a');

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    const [firstButton, secondButton] = screen.getAllByRole('button', { name: /cart.loyalty.apply/ });
    expect(firstButton).toBeDisabled();
    expect(secondButton).toBeEnabled();
  });

  it('offers a bulk remove only when more than one campaign is applied', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [rekonectCandidate('promo-a'), rekonectCandidate('promo-b')],
    };

    const { rerender } = render(<CartPromotions cartId={CART_ID} appliedPromotions={[applied('promo-a')]} />);
    expect(screen.queryByText('cart.loyalty.removeAll')).not.toBeInTheDocument();

    rerender(<CartPromotions cartId={CART_ID} appliedPromotions={[applied('promo-a'), applied('promo-b')]} />);
    fireEvent.click(screen.getByText('cart.loyalty.removeAll'));

    expect(cartApi.removeExternalPromotion).toHaveBeenCalledWith(CART_ID);
  });

  it('renders a quiet empty state instead of an error when there are no campaigns', () => {
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

  it('hints at unmet conditions but still lets the user try applying', () => {
    cartApi.availablePromotionsByCart = {
      [CART_ID]: [rekonectCandidate('promo-a', { applicable: false })],
    };

    render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    expect(screen.getByText('cart.loyalty.conditionsHint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cart.loyalty.apply/ })).toBeEnabled();
  });

  it('refetches when the cached lists are invalidated', async () => {
    const { rerender } = render(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);
    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledTimes(1));

    cartApi.promotionsVersion = 1;
    rerender(<CartPromotions cartId={CART_ID} appliedPromotions={[]} />);

    await waitFor(() => expect(cartApi.loadAvailablePromotions).toHaveBeenCalledTimes(2));
  });
});
