'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gift, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ProductRewardProgress } from '@/components/cart/ProductRewardProgress';
import { RewardItemPicker } from '@/components/cart/RewardItemPicker';
import { useCart } from '@/context/CartContext';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { resolveUnapplicableReason } from '@/lib/loyalty-errors';
import {
  getProductReward,
  requiresRewardSelection,
  resolveEligibleRewardItems,
  resolveProductRewardProgress,
} from '@/lib/loyalty-rewards';
import {
  CartItem,
  CartPromotion,
  LoyaltyProviderType,
  promotionKey,
  RemovePromotionInput,
} from '@/types/cart';

interface CartPromotionsProps {
  cartId: string;
  /** Applied promotions straight from the cart response — the only source of truth. */
  appliedPromotions?: CartPromotion[];
  /** Renders the manual coupon-code field for codes the list does not carry yet. */
  allowCouponCode?: boolean;
  /** Live cart lines — a product reward is spent on one of them. */
  cartItems?: CartItem[];
  /** Branch menu route, for the "add an eligible item" link on a reward row. */
  menuHref?: string;
  className?: string;
}

/**
 * Every promotion for a cart — internal Runmeal coupons and Rekonect campaigns
 * alike. One list, one row shape; the only provider specific bit is the remove
 * payload the backend expects.
 *
 * Every price and every applied-promotion decision comes from the backend: this
 * component only lists candidates, sends apply/remove, and renders what comes back.
 */
export function CartPromotions({
  cartId,
  appliedPromotions,
  allowCouponCode = false,
  cartItems,
  menuHref = '/',
  className,
}: CartPromotionsProps) {
  const { t } = useTranslation();
  const {
    availablePromotionsByCart,
    promotionsVersion,
    loadAvailablePromotions,
    isPromotionsLoading,
    hasPromotionsError,
    applyPromotion,
    removePromotion,
    isPromotionPending,
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [isCouponSubmitting, setIsCouponSubmitting] = useState(false);

  // Load once the cart exists, and again whenever the lists are invalidated.
  useEffect(() => {
    if (!cartId) return;
    loadAvailablePromotions(cartId);
  }, [cartId, promotionsVersion, loadAvailablePromotions]);

  const applied = useMemo(() => appliedPromotions || [], [appliedPromotions]);

  const appliedKeys = useMemo(() => new Set(applied.map(promotionKey)), [applied]);

  const availableByKey = useMemo(
    () => new Map((availablePromotionsByCart[cartId] || []).map((promotion) => [promotionKey(promotion), promotion])),
    [availablePromotionsByCart, cartId],
  );

  const rows = useMemo<CartPromotion[]>(() => {
    const candidates = (availablePromotionsByCart[cartId] || []).filter(
      (promotion) => !appliedKeys.has(promotionKey(promotion)),
    );

    // Applied first, and an applied promotion that dropped out of the candidate
    // list must stay removable.
    //
    // The two lists describe a product reward from different sides: the cart
    // says which line it landed on, the available list says how far the customer
    // is toward the next one. Merging keeps both halves on the applied row —
    // the cart's values win wherever they overlap.
    const mergedApplied = applied.map((appliedPromotion) => {
      const candidate = availableByKey.get(promotionKey(appliedPromotion));
      if (!candidate) return appliedPromotion;
      return {
        ...candidate,
        ...appliedPromotion,
        productReward: (candidate.productReward || appliedPromotion.productReward)
          ? { ...candidate.productReward, ...appliedPromotion.productReward }
          : null,
      };
    });

    return [...mergedApplied, ...candidates];
  }, [availablePromotionsByCart, cartId, applied, appliedKeys, availableByKey]);

  const appliedRekonectCount = applied.filter(
    (promotion) => promotion.type === LoyaltyProviderType.REKONECT,
  ).length;
  const removeAllRekonect: RemovePromotionInput = { type: LoyaltyProviderType.REKONECT };

  const isLoading = isPromotionsLoading(cartId);
  const hasError = hasPromotionsError(cartId);
  const isRemovingAll = isPromotionPending(cartId, removeAllRekonect);

  const handleApplyCouponCode = async () => {
    const code = couponCode.trim();
    if (!code) return;

    setIsCouponSubmitting(true);
    try {
      // A hand typed code is always an internal Runmeal coupon.
      const didApply = await applyPromotion(cartId, {
        type: LoyaltyProviderType.INTERNAL,
        promotionCode: code,
      });
      if (didApply) {
        setCouponCode('');
      }
    } finally {
      setIsCouponSubmitting(false);
    }
  };

  return (
    <section className={className} aria-labelledby={`cart-promotions-${cartId}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          id={`cart-promotions-${cartId}`}
          className="flex items-center gap-2 text-sm font-semibold text-zinc-900"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-orange-600" />
          {t('cart.loyalty.title')}
        </h3>
        {appliedRekonectCount > 1 && (
          <button
            type="button"
            onClick={() => removePromotion(cartId, removeAllRekonect)}
            disabled={isRemovingAll}
            className="shrink-0 text-xs font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('cart.loyalty.removeAll')}
          </button>
        )}
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        hasError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">{t('cart.loyalty.loadError')}</p>
            <button
              type="button"
              onClick={() => loadAvailablePromotions(cartId)}
              className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              {t('cart.loyalty.retry')}
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">
            {t('cart.loyalty.empty')}
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {rows.map((promotion) => {
            const isApplied = appliedKeys.has(promotionKey(promotion));
            // Several Rekonect campaigns can sit on one cart, so they are removed
            // by their own code; internal coupons are removed per provider.
            // A product reward can sit next to a regular coupon, so like a
            // Rekonect campaign it is removed by its own code. Plain internal
            // coupons keep being removed per provider.
            const removeInput: RemovePromotionInput =
              promotion.type === LoyaltyProviderType.REKONECT || getProductReward(promotion)
                ? { type: promotion.type, promotionCode: promotion.promotionCode }
                : { type: promotion.type };

            return (
              <PromotionRow
                key={promotionKey(promotion)}
                promotion={promotion}
                isApplied={isApplied}
                isPending={isPromotionPending(cartId, isApplied ? removeInput : promotion)}
                cartItems={cartItems ?? []}
                menuHref={menuHref}
                onApply={(selectedCartItemId) =>
                  applyPromotion(cartId, {
                    type: promotion.type,
                    promotionCode: promotion.promotionCode,
                    ...(selectedCartItemId ? { selectedCartItemId } : {}),
                  })
                }
                onRemove={() => removePromotion(cartId, removeInput)}
              />
            );
          })}
        </ul>
      )}

      {allowCouponCode && (
        <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
          <input
            type="text"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder={t('cart.loyalty.couponPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isCouponSubmitting}
            disabled={!couponCode.trim()}
            onClick={handleApplyCouponCode}
            className="shrink-0"
          >
            {t('cart.loyalty.apply')}
          </Button>
        </div>
      )}
    </section>
  );
}

function PromotionRow({
  promotion,
  isApplied,
  isPending,
  cartItems,
  menuHref,
  onApply,
  onRemove,
}: {
  promotion: CartPromotion;
  isApplied: boolean;
  isPending: boolean;
  cartItems: CartItem[];
  menuHref: string;
  onApply: (selectedCartItemId?: string) => Promise<boolean> | void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const unapplicableReason = resolveUnapplicableReason(promotion.unapplicableReason, t);

  const productReward = getProductReward(promotion);
  const progress = resolveProductRewardProgress(productReward);
  // The customer picks which cart line a product reward is spent on, so the
  // eligible lines are recomputed from the live cart — a cart change drops the
  // promotion on the backend and has to drop a stale selection here too.
  const eligibleItems = useMemo(
    () => resolveEligibleRewardItems(productReward, cartItems),
    [productReward, cartItems],
  );
  const needsSelection = !isApplied && requiresRewardSelection(promotion);
  // Applying the reward removes the reason to choose, which closes the picker
  // on its own — no effect needed to tidy up after it.
  const showPicker = isPickerOpen && needsSelection;

  const handleApply = async (selectedCartItemId?: string) => {
    const applied = await onApply(selectedCartItemId);
    // A rejected selection leaves the picker open with the refreshed cart, so
    // the customer can choose again without reopening it.
    if (applied) setIsPickerOpen(false);
  };

  const handleApplyClick = () => {
    if (!needsSelection) {
      handleApply();
      return;
    }
    // Nothing to choose between: one eligible line is the selection.
    if (eligibleItems.length === 1) {
      handleApply(eligibleItems[0].id);
      return;
    }
    setIsPickerOpen(true);
  };

  return (
    <li
      className={`flex flex-wrap items-start gap-3 rounded-xl border p-3 transition-colors sm:flex-nowrap ${
        isApplied ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
        <ImageWithFallback
          src={promotion.imageUrl}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          fallbackClassName="object-contain p-1.5 opacity-40"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold text-zinc-900">{promotion.name}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            <Gift className="h-3 w-3" />
            {t(`cart.loyalty.providers.${promotion.type}`)}
          </span>
        </div>
        {promotion.description ? (
          <p className="mt-1 break-words text-xs leading-snug text-zinc-500">{promotion.description}</p>
        ) : null}
        {/* "Not earned yet" is exactly what the progress bar below already says,
            so a reward row with a bar drops the sentence. */}
        {!isApplied && !promotion.applicable && !(productReward && progress) ? (
          <p className="mt-1 break-words text-xs leading-snug text-amber-600">
            {unapplicableReason || t('cart.loyalty.conditionsHint')}
          </p>
        ) : null}
        {productReward && (
          <ProductRewardProgress
            reward={productReward}
            isApplied={isApplied}
            applicable={promotion.applicable}
            unapplicableReason={promotion.unapplicableReason}
            cartItems={cartItems}
            menuHref={menuHref}
          />
        )}
      </div>

      <div className="w-full shrink-0 sm:w-auto">
        {isApplied ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isPending}
            onClick={onRemove}
            className="w-full border-green-300 bg-white text-green-700 hover:bg-green-100 sm:w-auto"
          >
            {t('cart.loyalty.remove')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isPending}
            disabled={!promotion.applicable}
            onClick={handleApplyClick}
            className="w-full sm:w-auto"
          >
            {needsSelection ? t('cart.loyalty.productReward.choose') : t('cart.loyalty.apply')}
          </Button>
        )}
      </div>

      {showPicker && productReward && (
        <RewardItemPicker
          reward={productReward}
          items={eligibleItems}
          isPending={isPending}
          onConfirm={handleApply}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </li>
  );
}
