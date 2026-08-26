'use client';

import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/order-display';
import { resolveRewardItemPrice, resolveRewardTargetName } from '@/lib/loyalty-rewards';
import type { CartItem, CartProductReward } from '@/types/cart';

/**
 * The cart line a product reward is spent on.
 *
 * The customer chooses, not the backend: picking the pricier eligible line is
 * allowed and is what the discount is then worth. The choice is a cart line, not
 * a product — the same coffee added twice with different options is two lines,
 * and only the picked one loses its base price.
 */
export function RewardItemPicker({
  reward,
  items,
  isPending,
  onConfirm,
  onClose,
}: {
  reward: CartProductReward;
  items: CartItem[];
  isPending: boolean;
  onConfirm: (cartItemId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const targetName = resolveRewardTargetName(reward);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The cart can be re-priced under the picker — by another tab, or by the
  // failed apply that refetched it. A selection that is gone falls back to the
  // first line that is still eligible. Resolved while rendering so the list and
  // the highlighted row never disagree for a frame.
  const resolvedSelectedId = selectedId && items.some((item) => item.id === selectedId)
    ? selectedId
    : items[0]?.id ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('cart.loyalty.productReward.selectTitle')}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 bg-orange-600 p-4 text-white">
          <Gift className="h-5 w-5 shrink-0" />
          <h2 className="flex-1 text-lg font-bold">
            {targetName
              ? t('cart.loyalty.productReward.selectTitleNamed', { name: targetName })
              : t('cart.loyalty.productReward.selectTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-full p-1.5 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <p className="text-xs text-zinc-500">{t('cart.loyalty.productReward.selectHint')}</p>

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">
              {t('cart.loyalty.productReward.selectEmpty')}
            </p>
          ) : (
            items.map((item) => {
              const isSelected = item.id === resolvedSelectedId;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-orange-600 bg-orange-50/60'
                      : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-zinc-800">
                      {item.qty}x {item.productName}
                    </p>
                    {(item.options ?? []).length > 0 && (
                      <p className="mt-0.5 break-words text-xs text-zinc-500">
                        {(item.options ?? [])
                          .map((group) => (group.selections ?? []).map((selection) => selection.optionName).join(', '))
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-zinc-800">
                      {formatCurrency(resolveRewardItemPrice(item))}
                    </p>
                    {isSelected && (
                      <p className="text-[11px] font-medium text-green-600">
                        {t('cart.loyalty.productReward.selectDiscount', {
                          amount: formatCurrency(resolveRewardItemPrice(item)),
                        })}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}

          {reward.basePriceOnly && (
            <p className="text-[11px] text-zinc-400">{t('cart.loyalty.productReward.basePriceOnly')}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            isLoading={isPending}
            disabled={!resolvedSelectedId}
            onClick={() => resolvedSelectedId && onConfirm(resolvedSelectedId)}
          >
            {t('cart.loyalty.productReward.selectConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
