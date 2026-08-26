'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, RefreshCw, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The customer's member QR — a signed value the backend issues, identical for
 * every campaign and every branch, so the wallet renders it once above the
 * stamp cards instead of repeating it on each of them. The value is drawn
 * exactly as received; it is never built from the customer id.
 */

interface MemberQrCardProps {
    /** `qrValue` straight from `GET /loyalty/stamps/qr`. */
    payload: string | null;
    isLoading: boolean;
    hasError: boolean;
    onRetry: () => void;
    onExpand: () => void;
}

export function MemberQrCard({ payload, isLoading, hasError, onRetry, onExpand }: MemberQrCardProps) {
    const { t } = useTranslation();

    if (!payload) {
        return (
            <div className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
                <span className={`h-[72px] w-[72px] shrink-0 rounded-xl bg-zinc-100 ${isLoading ? 'animate-pulse' : ''}`} />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900">{t('rewards.memberQrTitle')}</span>
                    <span className="mt-1 block text-xs leading-snug text-zinc-500">
                        {hasError ? t('rewards.qrError') : t('rewards.qrLoading')}
                    </span>
                </span>
                {hasError && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-orange-400 hover:text-orange-600"
                    >
                        <RefreshCw size={13} /> {t('rewards.retry')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onExpand}
            className="group flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/60 sm:gap-4 sm:p-5"
        >
            <span className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-zinc-100">
                <QRCodeSVG value={payload} size={72} level="M" marginSize={0} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-zinc-900">
                    <ScanLine size={15} className="shrink-0 text-orange-600" />
                    {t('rewards.memberQrTitle')}
                </span>
                <span className="mt-1 block text-xs leading-snug text-zinc-500">{t('rewards.memberQrHint')}</span>
            </span>

            <Maximize2 size={18} className="shrink-0 text-zinc-400 transition-colors group-hover:text-orange-600" />
        </button>
    );
}
