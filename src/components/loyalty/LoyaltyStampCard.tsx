'use client';

import React from 'react';
import { Check, Coffee, Gift, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    formatStampDate,
    resolveCardSubtitle,
    resolveCardTitle,
    resolveStampProgress,
} from '@/lib/loyalty-stamps';
import { StampCard } from '@/types/loyalty-stamp';

/**
 * One category campaign card: the stamp grid and the progress copy.
 *
 * There is deliberately no QR and no redeem button here. The code the manager
 * scans is the customer's member QR — one per customer, rendered once by the
 * wallet — and redemption is confirmed by the manager after that scan, never
 * from the customer app.
 */

interface LoyaltyStampCardProps {
    card: StampCard;
}

export function LoyaltyStampCardView({ card }: LoyaltyStampCardProps) {
    const { t } = useTranslation();
    const progress = resolveStampProgress(card);

    const title = resolveCardTitle(card);
    const subtitle = resolveCardSubtitle(card);
    // Reward windows are instants, so the expiry is shown down to the minute.
    const expiryLabel = formatStampDate(card.rewardExpiresAt, true);
    // Kept visible only because an earned reward outlives the campaign itself.
    const isEndedCampaign = card.campaignStatus === 'INACTIVE';

    return (
        <div
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${progress.isRewardAvailable ? 'border-orange-300 ring-1 ring-orange-200' : 'border-zinc-200'
                }`}
        >
            {/* Header */}
            <div className="relative overflow-hidden bg-orange-600 px-5 py-4 text-white">
                {/* Soft brand wash so the header does not read as a flat block. */}
                <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <span className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-black/5" />

                <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{title}</p>
                        {subtitle !== title && <p className="mt-0.5 truncate text-xs text-white/80">{subtitle}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap">
                        {t('rewards.buyGet', { target: progress.target })}
                    </span>
                </div>
            </div>

            <div className="space-y-5 p-5">
                {/* Stamp grid */}
                <div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: progress.target }, (_, index) => {
                            const isFilled = index < progress.earned;
                            const isLastFilled = index === progress.earned - 1;
                            return (
                                <span
                                    key={index}
                                    aria-hidden
                                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${isFilled
                                        ? 'border-orange-600 bg-orange-600 text-white'
                                        : 'border-dashed border-zinc-200 bg-zinc-50 text-zinc-300'
                                        } ${isLastFilled ? 'stamp-pop' : ''}`}
                                >
                                    <Coffee size={16} />
                                </span>
                            );
                        })}
                    </div>
                    <p className="sr-only">{t('rewards.progressAria', { earned: progress.earned, target: progress.target })}</p>
                </div>

                {/* Progress bar + counter */}
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-zinc-900">
                            {progress.earned} <span className="text-zinc-400">/ {progress.target}</span>
                        </span>
                        <span className={progress.isRewardAvailable ? 'text-xs font-semibold text-orange-600' : 'text-xs text-zinc-500'}>
                            {progress.isRewardAvailable
                                ? t('rewards.readyToRedeem')
                                : t('rewards.remaining', { remainingCount: progress.remaining, product: title })}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                            className="h-full rounded-full bg-orange-600 transition-[width] duration-700 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                    {progress.isRewardAvailable ? (
                        <p className="flex items-center gap-1.5 text-[11px] leading-snug text-zinc-500">
                            <Lock size={12} className="shrink-0" /> {t('rewards.cardLocked')}
                        </p>
                    ) : (
                        <p className="text-[11px] leading-snug text-zinc-400">
                            {t('rewards.cycleNote', { cycle: card.cycleNumber })}
                        </p>
                    )}
                </div>

                {/* Reward line */}
                <div
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${progress.isRewardAvailable ? 'bg-orange-50 text-zinc-900' : 'bg-zinc-50 text-zinc-600'
                        }`}
                >
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${progress.isRewardAvailable ? 'bg-orange-600 text-white' : 'bg-white text-zinc-400 border border-zinc-200'
                            }`}
                    >
                        {progress.isRewardAvailable ? <Check size={17} /> : <Gift size={17} />}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{card.campaignName || title}</p>
                        <p className="text-xs leading-snug text-zinc-500">
                            {progress.isRewardAvailable ? t('rewards.rewardWaiting') : t('rewards.rewardPending')}
                        </p>
                    </div>
                </div>

                {isEndedCampaign && progress.isRewardAvailable && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] leading-snug text-amber-700">
                        {t('rewards.campaignEnded')}
                    </p>
                )}

                {expiryLabel && (
                    <p className="text-center text-[11px] text-zinc-400">{t('rewards.rewardExpiresAt', { date: expiryLabel })}</p>
                )}
            </div>
        </div>
    );
}
