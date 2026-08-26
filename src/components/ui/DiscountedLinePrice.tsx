'use client';

import { useTranslation } from 'react-i18next';
import { Gift } from 'lucide-react';
import { formatCurrency } from '@/lib/order-display';

interface DiscountedLinePriceProps {
    /** Line price before any promotion; falls back to `fallbackTotal`. */
    lineTotal?: number | string | null;
    /** What the promotion took off this line. */
    discountAmount?: number | string | null;
    /** Line price after the promotion; falls back to `lineTotal`. */
    finalLineTotal?: number | string | null;
    /** `price * qty`, for responses that predate the line level fields. */
    fallbackTotal: number;
    currencySymbol?: string | null;
    className?: string;
}

/**
 * One cart or order line's price, with the product reward discount shown on the
 * line the backend picked. Only that line carries a discount — the reward pays
 * for a single unit's base price, so options and extras stay in the total and
 * the struck-through original is what makes that visible.
 *
 * Every value comes from the backend; nothing here recomputes a discount.
 */
export function DiscountedLinePrice({
    lineTotal,
    discountAmount,
    finalLineTotal,
    fallbackTotal,
    currencySymbol,
    className = '',
}: DiscountedLinePriceProps) {
    const { t } = useTranslation();
    const discount = Number(discountAmount ?? 0);
    const original = lineTotal == null ? fallbackTotal : Number(lineTotal);
    const final = finalLineTotal == null ? original : Number(finalLineTotal);

    if (!(discount > 0)) {
        return <span className={className}>{formatCurrency(final, currencySymbol)}</span>;
    }

    return (
        <span className={`flex flex-col items-end gap-0.5 ${className}`}>
            <span className="flex items-center gap-1.5">
                <span className="text-xs font-normal text-zinc-400 line-through">
                    {formatCurrency(original, currencySymbol)}
                </span>
                <span>{formatCurrency(final, currencySymbol)}</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
                <Gift size={11} className="shrink-0" />
                {t('cart.loyalty.productReward.lineDiscount', {
                    amount: formatCurrency(discount, currencySymbol),
                })}
            </span>
        </span>
    );
}
