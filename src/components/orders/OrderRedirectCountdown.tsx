'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface OrderRedirectCountdownProps {
  href: string;
  seconds?: number;
}

const TICK_MS = 100;

/**
 * Counts down on the payment success screen, then opens the order. Uses
 * `replace` so Back from the order does not land on the callback page again.
 * Unmount it to cancel.
 */
export function OrderRedirectCountdown({ href, seconds = 5 }: OrderRedirectCountdownProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const totalMs = seconds * 1000;
  const [remainingMs, setRemainingMs] = useState(totalMs);
  // The query can fill in after mount (e.g. the branch id); that must not
  // restart the countdown, only change where it lands.
  const hrefRef = useRef(href);

  useEffect(() => {
    hrefRef.current = href;
  }, [href]);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, totalMs - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left === 0) {
        window.clearInterval(timer);
        router.replace(hrefRef.current);
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [totalMs, router]);

  return (
    <div className="mb-6 w-full" role="status">
      <p className="mb-2 text-sm text-zinc-500">
        {t('payment.redirectingToOrder', { seconds: Math.ceil(remainingMs / 1000) })}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-green-500 transition-[width] duration-100 ease-linear"
          style={{ width: `${((totalMs - remainingMs) / totalMs) * 100}%` }}
        />
      </div>
    </div>
  );
}
