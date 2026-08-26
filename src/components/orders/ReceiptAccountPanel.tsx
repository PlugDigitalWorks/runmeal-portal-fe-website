'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useUser } from '@/context/UserContext';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import {
  orderService,
  ReceiptAccountResponse,
  ReceiptDeliveryStatus,
} from '@/services/order.service';

interface ReceiptAccountPanelProps {
  orderId: string;
}

/**
 * Asks the backend to e-mail the receipt for one order.
 *
 * The portal only ever serves signed-in customers, so the account half of the
 * endpoint is already satisfied and the e-mail defaults to the one on file —
 * the field stays editable because a receipt often has to go somewhere else.
 */
export function ReceiptAccountPanel({ orderId }: ReceiptAccountPanelProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [email, setEmail] = useState(user?.email ?? '');
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<ReceiptAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!accepted || !email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await orderService.requestReceiptAccount(orderId, email.trim());
      setEmail(email.trim().toLowerCase());
      setResult(response);
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('payment.receipt.errors.generic')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const receiptMessage = (status: ReceiptDeliveryStatus) => t(`payment.receipt.status.${status}`);

  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 text-left">
      {!result ? (
        <form onSubmit={submitReceipt} className="space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <h2 className="font-semibold text-zinc-900">{t('payment.receipt.title')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t('payment.receipt.disclaimer')}</p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">{t('auth.email')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              required
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-orange-600"
            />
            <span>{t('payment.receipt.consent')}</span>
          </label>

          {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !accepted}
            className="flex w-full items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t('payment.receipt.submitting') : t('payment.receipt.submit')}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">{receiptMessage(result.receiptStatus)}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t('payment.receipt.disclaimer')}</p>
            </div>
          </div>

          {/* Queued means the backend accepted it but has not sent it yet — the
              customer can ask again rather than being left without a receipt. */}
          {result.receiptStatus === 'queued' && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              {t('payment.receipt.retryReceipt')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
