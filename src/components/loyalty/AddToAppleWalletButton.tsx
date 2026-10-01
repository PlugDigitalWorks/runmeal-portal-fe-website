'use client';

import React from 'react';
import { AlertCircle, Loader2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppleWalletPass } from '@/hooks/useLoyaltyStamps';

/**
 * "Add to Apple Wallet" for one stamp campaign card.
 *
 * The pass is built and signed by the backend and carries the same member QR as
 * the in-app wallet; this button only requests a fresh download link and sends
 * the browser to it. On iPhone that opens the Wallet preview where the customer
 * confirms "Add". Devices without Apple Wallet never see the button, and on a
 * Mac it stays usable but points the customer to their iPhone, since the pass
 * may only preview or download there.
 */

interface AddToAppleWalletButtonProps {
    brandId: string;
    campaignId: string;
}

export function AddToAppleWalletButton({ brandId, campaignId }: AddToAppleWalletButtonProps) {
    const { t } = useTranslation();
    const { platform, isCreating, error, add } = useAppleWalletPass(brandId, campaignId);

    if (platform === 'unsupported') return null;

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={add}
                disabled={isCreating}
                aria-busy={isCreating}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            >
                {isCreating ? (
                    <Loader2 size={17} className="animate-spin" aria-hidden />
                ) : (
                    <Wallet size={17} aria-hidden />
                )}
                <span>{isCreating ? t('rewards.appleWallet.creating') : t('rewards.appleWallet.add')}</span>
            </button>

            {platform === 'mac' && !error && (
                <p className="text-center text-[11px] leading-snug text-zinc-400">{t('rewards.appleWallet.macHint')}</p>
            )}

            {error && (
                <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-snug text-red-600">
                    <AlertCircle size={12} className="mt-px shrink-0" aria-hidden /> {error}
                </p>
            )}
        </div>
    );
}
