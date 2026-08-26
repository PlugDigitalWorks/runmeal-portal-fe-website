import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CartProvider, useCart } from './CartContext';
import { cartService } from '@/services/cart.service';
import { LoyaltyProviderType, promotionKey, type Cart, type CartPromotion } from '@/types/cart';

vi.mock('@/services/cart.service', () => ({
  cartService: {
    getAllCarts: vi.fn(),
    getCart: vi.fn(),
    addItem: vi.fn(),
    setQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    getAvailablePromotions: vi.fn(),
    applyPromotion: vi.fn(),
    removePromotion: vi.fn(),
  },
}));

vi.mock('@/services/user.service', () => ({
  userService: { createAddress: vi.fn() },
}));

// Identities must be stable across renders, exactly like the real contexts
// (state values + useCallback), otherwise the provider effects re-run forever.
const stable = vi.hoisted(() => ({
  user: { id: 'user-1' },
  addresses: [] as unknown[],
  refreshAddresses: async () => {},
  selectedBranch: { id: 'branch-1' },
  translation: { t: (key: string) => key },
}));

vi.mock('@/context/UserContext', () => ({
  useUser: () => ({
    user: stable.user,
    addresses: stable.addresses,
    refreshAddresses: stable.refreshAddresses,
  }),
}));

vi.mock('@/context/BranchContext', () => ({
  useBranch: () => ({ selectedBranch: stable.selectedBranch }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
  // The context now resolves API error codes through `@/lib/api-errors`,
  // which pulls in the i18n config module.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const mockedCartService = vi.mocked(cartService);

const CART_ID = 'cart-1';
/** Must match `stable.selectedBranch.id` — every cart call is branch scoped. */
const BRANCH_ID = 'branch-1';

const buildCart = (overrides: Partial<Cart> = {}): Cart => ({
  cartId: CART_ID,
  brandId: 'brand-1',
  branchId: BRANCH_ID,
  userId: 'user-1',
  totalCartPrice: 270,
  discountAmount: 0,
  finalPrice: 270,
  appliedPromotions: [],
  isActive: true,
  items: [
    { id: 'item-1', productId: 'burger', productName: 'Burger', price: 135, imgUrl: null, qty: 2 },
  ],
  ...overrides,
});

const promotion = (
  promotionCode: string,
  type: LoyaltyProviderType = LoyaltyProviderType.REKONECT,
): CartPromotion => ({
  type,
  promotionCode,
  name: `Kampanya ${promotionCode}`,
  description: 'Açıklama',
  creditType: 'gift',
  creditValue: 50,
  imageUrl: null,
  applicable: true,
  unapplicableReason: null,
});

const rekonect = (promotionCode: string) => ({
  type: LoyaltyProviderType.REKONECT,
  promotionCode,
});

/** Server-side cart the GET mocks read from, so refetches see what the backend "stored". */
let serverCart: Cart;

function Harness() {
  const { carts, applyPromotion, removePromotion, updateQuantity, isPromotionPending } = useCart();
  const cart = carts.find((candidate) => candidate.cartId === CART_ID);

  return (
    <div>
      <span data-testid="total">{cart?.totalCartPrice ?? ''}</span>
      <span data-testid="discount">{cart?.discountAmount ?? ''}</span>
      <span data-testid="final">{cart?.finalPrice ?? ''}</span>
      <span data-testid="applied">{(cart?.appliedPromotions ?? []).map(promotionKey).join(',')}</span>
      <span data-testid="pending-a">{String(isPromotionPending(CART_ID, rekonect('promo-a')))}</span>
      <span data-testid="pending-b">{String(isPromotionPending(CART_ID, rekonect('promo-b')))}</span>
      <button onClick={() => applyPromotion(CART_ID, rekonect('promo-a'))}>apply-a</button>
      <button onClick={() => applyPromotion(CART_ID, rekonect('promo-b'))}>apply-b</button>
      <button onClick={() => removePromotion(CART_ID, rekonect('promo-a'))}>remove-a</button>
      <button
        onClick={() => applyPromotion(CART_ID, { type: LoyaltyProviderType.INTERNAL, promotionCode: 'WELCOME10' })}
      >
        apply-coupon
      </button>
      <button onClick={() => removePromotion(CART_ID, { type: LoyaltyProviderType.INTERNAL })}>
        remove-coupon
      </button>
      <button onClick={() => updateQuantity('item-1', 1)}>set-qty-1</button>
    </div>
  );
}

const renderHarness = async () => {
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );

  await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('270'));
};

const apiError = (code: string, status = 400) => ({
  response: {
    status,
    data: { status: false, message: 'technical message', code, statusCode: status, data: { provider: 'REKONECT' } },
  },
});

describe('CartContext promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverCart = buildCart();
    mockedCartService.getAllCarts.mockImplementation(async () => [serverCart]);
    mockedCartService.getCart.mockImplementation(async () => serverCart);
    mockedCartService.getAvailablePromotions.mockResolvedValue([]);
  });

  it('writes the apply response straight into cart state without recomputing prices', async () => {
    await renderHarness();

    mockedCartService.applyPromotion.mockResolvedValue(
      buildCart({ totalCartPrice: 270, discountAmount: 89, finalPrice: 181, appliedPromotions: [promotion('promo-a')] }),
    );

    fireEvent.click(screen.getByText('apply-a'));

    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-a'));
    expect(screen.getByTestId('total')).toHaveTextContent('270');
    expect(screen.getByTestId('discount')).toHaveTextContent('89');
    expect(screen.getByTestId('final')).toHaveTextContent('181');
    expect(mockedCartService.applyPromotion).toHaveBeenCalledWith(
      CART_ID,
      rekonect('promo-a'),
      'DELIVERY',
      BRANCH_ID,
    );
  });

  it('applies an internal coupon through the same mutation', async () => {
    await renderHarness();

    mockedCartService.applyPromotion.mockResolvedValue(
      buildCart({
        discountAmount: 27,
        finalPrice: 243,
        appliedPromotions: [promotion('WELCOME10', LoyaltyProviderType.INTERNAL)],
      }),
    );

    fireEvent.click(screen.getByText('apply-coupon'));

    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('INTERNAL:WELCOME10'));
    expect(mockedCartService.applyPromotion).toHaveBeenCalledWith(
      CART_ID,
      { type: LoyaltyProviderType.INTERNAL, promotionCode: 'WELCOME10' },
      'DELIVERY',
      BRANCH_ID,
    );
  });

  it('removes every internal promotion without sending a code', async () => {
    serverCart = buildCart({
      discountAmount: 27,
      finalPrice: 243,
      appliedPromotions: [promotion('WELCOME10', LoyaltyProviderType.INTERNAL)],
    });
    await renderHarness();

    mockedCartService.removePromotion.mockResolvedValue(buildCart());

    fireEvent.click(screen.getByText('remove-coupon'));

    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent(''));
    expect(mockedCartService.removePromotion).toHaveBeenCalledWith(
      CART_ID,
      { type: LoyaltyProviderType.INTERNAL },
      BRANCH_ID,
    );
  });

  it('supports several campaigns at once and keeps the others when one is removed', async () => {
    await renderHarness();

    mockedCartService.applyPromotion.mockResolvedValueOnce(
      buildCart({ discountAmount: 50, finalPrice: 220, appliedPromotions: [promotion('promo-a')] }),
    );
    fireEvent.click(screen.getByText('apply-a'));
    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-a'));

    mockedCartService.applyPromotion.mockResolvedValueOnce(
      buildCart({
        discountAmount: 89,
        finalPrice: 181,
        appliedPromotions: [promotion('promo-a'), promotion('promo-b')],
      }),
    );
    fireEvent.click(screen.getByText('apply-b'));
    await waitFor(() =>
      expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-a,REKONECT:promo-b'),
    );

    // Removing one campaign returns the re-priced cart that still holds the other.
    mockedCartService.removePromotion.mockResolvedValue(
      buildCart({ discountAmount: 39, finalPrice: 231, appliedPromotions: [promotion('promo-b')] }),
    );
    fireEvent.click(screen.getByText('remove-a'));

    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-b'));
    expect(screen.getByTestId('applied')).not.toHaveTextContent('promo-a');
    expect(screen.getByTestId('final')).toHaveTextContent('231');
    expect(mockedCartService.removePromotion).toHaveBeenCalledWith(CART_ID, rekonect('promo-a'), BRANCH_ID);
  });

  it('ignores a double click on the same campaign but allows a different one', async () => {
    await renderHarness();

    let resolveApply: ((cart: Cart) => void) | undefined;
    mockedCartService.applyPromotion.mockImplementation(
      () => new Promise<Cart>((resolve) => {
        resolveApply = resolve;
      }),
    );

    fireEvent.click(screen.getByText('apply-a'));
    fireEvent.click(screen.getByText('apply-a'));

    await waitFor(() => expect(screen.getByTestId('pending-a')).toHaveTextContent('true'));
    expect(mockedCartService.applyPromotion).toHaveBeenCalledTimes(1);
    // Only the campaign being mutated is blocked.
    expect(screen.getByTestId('pending-b')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('apply-b'));
    expect(mockedCartService.applyPromotion).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveApply?.(buildCart({ appliedPromotions: [promotion('promo-a')] }));
    });
  });

  it('refetches the cart when the backend reports the campaign is no longer applicable', async () => {
    await renderHarness();

    // Backend already dropped the stale campaign and kept the valid one.
    serverCart = buildCart({ discountAmount: 39, finalPrice: 231, appliedPromotions: [promotion('promo-b')] });
    mockedCartService.applyPromotion.mockRejectedValue(
      apiError('LOYALTY_PROMOTION_NO_LONGER_APPLICABLE'),
    );

    fireEvent.click(screen.getByText('apply-a'));

    await waitFor(() => expect(mockedCartService.getCart).toHaveBeenCalledWith(CART_ID, BRANCH_ID));
    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-b'));
    expect(screen.getByTestId('final')).toHaveTextContent('231');
  });

  it('does not mark a campaign applied when the request fails', async () => {
    await renderHarness();

    mockedCartService.applyPromotion.mockRejectedValue(apiError('LOYALTY_PROMOTION_NOT_APPLICABLE'));
    const getCartCallsBefore = mockedCartService.getCart.mock.calls.length;

    fireEvent.click(screen.getByText('apply-a'));

    await waitFor(() => expect(screen.getByTestId('pending-a')).toHaveTextContent('false'));
    expect(screen.getByTestId('applied')).toHaveTextContent('');
    expect(screen.getByTestId('final')).toHaveTextContent('270');
    // Only the stale-cart code triggers a resync; a plain rejection must not.
    expect(mockedCartService.getCart.mock.calls.length).toBe(getCartCallsBefore);
  });

  it('keeps client state untouched on a 5xx failure', async () => {
    await renderHarness();

    mockedCartService.applyPromotion.mockRejectedValue(apiError('INTERNAL_ERROR', 500));

    fireEvent.click(screen.getByText('apply-a'));

    await waitFor(() => expect(screen.getByTestId('pending-a')).toHaveTextContent('false'));
    expect(screen.getByTestId('applied')).toHaveTextContent('');
    expect(screen.getByTestId('discount')).toHaveTextContent('0');
  });

  it('replaces applied campaigns with the ones returned by a quantity update', async () => {
    serverCart = buildCart({ discountAmount: 89, finalPrice: 181, appliedPromotions: [promotion('promo-a')] });
    await renderHarness();
    await waitFor(() => expect(screen.getByTestId('applied')).toHaveTextContent('REKONECT:promo-a'));

    // Dropping to one burger invalidates the campaign server side.
    const repricedCart = buildCart({
      totalCartPrice: 135,
      discountAmount: 0,
      finalPrice: 135,
      appliedPromotions: [],
      items: [{ id: 'item-1', productId: 'burger', productName: 'Burger', price: 135, imgUrl: null, qty: 1 }],
    });
    serverCart = repricedCart;
    mockedCartService.setQty.mockResolvedValue(repricedCart);

    fireEvent.click(screen.getByText('set-qty-1'));

    await waitFor(() => expect(screen.getByTestId('final')).toHaveTextContent('135'));
    expect(screen.getByTestId('applied')).toHaveTextContent('');
  });
});
