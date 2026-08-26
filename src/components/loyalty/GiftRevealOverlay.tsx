'use client';

import React from 'react';
import { Gift, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The "you earned a reward" curtain: a gift box that rattles, pops its lid and
 * throws confetti before the reward name lands. Purely decorative — the reward
 * itself is already reflected on the card behind it.
 *
 * The whole timeline lives in globals.css (`gift-*` keyframes) so the lid, box
 * and confetti stay in sync; this component only mounts the pieces.
 */

const CONFETTI = [
    { x: '-150px', y: '-190px', r: '260deg', delay: '0ms', color: 'oklch(0.646 0.222 41.116)' },
    { x: '150px', y: '-200px', r: '-240deg', delay: '40ms', color: '#f472b6' },
    { x: '-210px', y: '-70px', r: '180deg', delay: '80ms', color: '#38bdf8' },
    { x: '210px', y: '-90px', r: '-200deg', delay: '20ms', color: '#a78bfa' },
    { x: '-90px', y: '-240px', r: '300deg', delay: '110ms', color: '#34d399' },
    { x: '90px', y: '-250px', r: '-280deg', delay: '60ms', color: 'oklch(0.646 0.222 41.116)' },
    { x: '-260px', y: '-150px', r: '160deg', delay: '140ms', color: '#fbbf24' },
    { x: '260px', y: '-160px', r: '-160deg', delay: '100ms', color: '#fb7185' },
];

interface GiftRevealOverlayProps {
    rewardName: string;
    merchantName: string;
    onClose: () => void;
}

export function GiftRevealOverlay({ rewardName, merchantName, onClose }: GiftRevealOverlayProps) {
    const { t } = useTranslation();

    // Escape closes it like any other modal; the animation is not interactive.
    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={rewardName}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-zinc-950/90 px-6 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
            >
                <X size={20} />
            </button>

            <div className="relative flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
                {/* Radial flash behind the box at the moment the lid leaves. */}
                <div
                    className="gift-burst pointer-events-none absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: 'radial-gradient(circle, oklch(0.646 0.222 41.116) 0%, transparent 70%)' }}
                />

                {CONFETTI.map((piece, index) => (
                    <span
                        key={index}
                        className="gift-confetti pointer-events-none absolute left-1/2 top-24 h-2.5 w-2.5 rounded-[2px]"
                        style={{
                            backgroundColor: piece.color,
                            animationDelay: piece.delay,
                            ['--confetti-x' as string]: piece.x,
                            ['--confetti-y' as string]: piece.y,
                            ['--confetti-r' as string]: piece.r,
                        }}
                    />
                ))}

                {/* Gift box */}
                <div className="gift-box relative h-32 w-36">
                    {/* Lid — the bow lives inside it so both leave together. */}
                    <div className="gift-lid absolute left-1/2 top-0 h-8 w-40 -translate-x-1/2 rounded-lg bg-orange-600 shadow-lg">
                        <span className="absolute left-1/2 top-0 h-full w-5 -translate-x-1/2 bg-white/35" />
                        {/* Bow: two loops and a knot. */}
                        <span className="absolute -top-4 left-1/2 h-5 w-6 -translate-x-[115%] rotate-[-22deg] rounded-full border-[5px] border-orange-600" />
                        <span className="absolute -top-4 left-1/2 h-5 w-6 translate-x-[15%] rotate-[22deg] rounded-full border-[5px] border-orange-600" />
                        <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-600" />
                    </div>
                    {/* Body */}
                    <div className="absolute bottom-0 left-1/2 h-24 w-36 -translate-x-1/2 overflow-hidden rounded-b-xl rounded-t-md bg-orange-600 shadow-2xl">
                        <span className="absolute left-1/2 top-0 h-full w-5 -translate-x-1/2 bg-white/35" />
                        <span className="absolute inset-x-0 top-1/3 h-4 bg-white/25" />
                        <span className="absolute inset-x-0 bottom-0 h-8 bg-black/10" />
                    </div>
                </div>

                <div className="gift-reward mt-10 flex flex-col items-center text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-600/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-600">
                        <Gift size={13} /> {t('rewards.giftUnlocked')}
                    </span>
                    <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">{rewardName}</h2>
                    <p className="mt-2 max-w-xs text-sm text-zinc-300">
                        {t('rewards.giftUnlockedBody', { merchant: merchantName })}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-7 rounded-full bg-orange-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
                    >
                        {t('rewards.showQr')}
                    </button>
                </div>
            </div>
        </div>
    );
}
