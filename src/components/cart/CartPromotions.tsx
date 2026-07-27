'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Gift, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import {
  AppliedPromotion,
  AvailablePromotion,
  getPromotionImage,
  isExternalPromotion,
} from '@/types/cart';

interface CartPromotionsProps {
  cartId: string;
  /** Applied promotions straight from the cart response — the only source of truth. */
  appliedPromotions?: AppliedPromotion[];
  className?: string;
}

/**
 * External (Rekonect) loyalty campaigns for a cart.
 *
 * Every price and every applied-campaign decision comes from the backend: this
 * component only lists candidates, sends apply/remove, and renders what comes back.
 */
export function CartPromotions({ cartId, appliedPromotions, className }: CartPromotionsProps) {
  const { t } = useTranslation();
  const {
    availablePromotionsByCart,
    promotionsVersion,
    loadAvailablePromotions,
    isPromotionsLoading,
    hasPromotionsError,
    applyExternalPromotion,
    removeExternalPromotion,
    isPromotionPending,
  } = useCart();

  // Load once the cart exists, and again whenever the lists are invalidated.
  useEffect(() => {
    if (!cartId) return;
    loadAvailablePromotions(cartId);
  }, [cartId, promotionsVersion, loadAvailablePromotions]);

  const appliedExternal = useMemo(
    () => (appliedPromotions || []).filter(isExternalPromotion),
    [appliedPromotions],
  );

  const appliedIds = useMemo(
    () => new Set(appliedExternal.map((promotion) => promotion.id)),
    [appliedExternal],
  );

  const rows = useMemo<AvailablePromotion[]>(() => {
    const candidates = (availablePromotionsByCart[cartId] || []).filter((item) =>
      isExternalPromotion(item.promotion),
    );

    // An applied campaign that dropped out of the candidate list must stay removable.
    const appliedOnly = appliedExternal
      .filter((promotion) => !candidates.some((item) => item.promotion.id === promotion.id))
      .map<AvailablePromotion>((promotion) => ({ applicable: true, promotion }));

    return [...candidates, ...appliedOnly];
  }, [availablePromotionsByCart, cartId, appliedExternal]);

  const isLoading = isPromotionsLoading(cartId);
  const hasError = hasPromotionsError(cartId);
  const isRemovingAll = isPromotionPending(cartId);

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
        {appliedExternal.length > 1 && (
          <button
            type="button"
            onClick={() => removeExternalPromotion(cartId)}
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
          {rows.map((row) => (
            <PromotionRow
              key={row.promotion.id}
              row={row}
              isApplied={appliedIds.has(row.promotion.id)}
              isPending={isPromotionPending(cartId, row.promotion.id)}
              onApply={() => applyExternalPromotion(cartId, row.promotion.id)}
              onRemove={() => removeExternalPromotion(cartId, row.promotion.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PromotionRow({
  row,
  isApplied,
  isPending,
  onApply,
  onRemove,
}: {
  row: AvailablePromotion;
  isApplied: boolean;
  isPending: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { promotion } = row;
  const [imageSrc, setImageSrc] = useState(() => getPromotionImage(promotion) || DEFAULT_PRODUCT_IMAGE);

  return (
    <li
      className={`flex flex-wrap items-start gap-3 rounded-xl border p-3 transition-colors sm:flex-nowrap ${
        isApplied ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
        <Image
          src={imageSrc}
          alt=""
          fill
          unoptimized
          sizes="48px"
          className={imageSrc === DEFAULT_PRODUCT_IMAGE ? 'object-contain p-1.5 opacity-90' : 'object-cover'}
          onError={() => setImageSrc(DEFAULT_PRODUCT_IMAGE)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold text-zinc-900">{promotion.name}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            <Gift className="h-3 w-3" />
            {t('cart.loyalty.providerLabel')}
          </span>
        </div>
        {promotion.description ? (
          <p className="mt-1 break-words text-xs leading-snug text-zinc-500">{promotion.description}</p>
        ) : null}
        {!isApplied && row.applicable === false ? (
          <p className="mt-1 break-words text-xs leading-snug text-amber-600">
            {t('cart.loyalty.conditionsHint')}
          </p>
        ) : null}
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
            onClick={onApply}
            className="w-full sm:w-auto"
          >
            {t('cart.loyalty.apply')}
          </Button>
        )}
      </div>
    </li>
  );
}
