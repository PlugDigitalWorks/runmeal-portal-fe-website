'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReceiptAccountPanel } from '@/components/orders/ReceiptAccountPanel';
import { useCart } from '@/context/CartContext';
import {
    isTerminalPaymentStatus,
    paymentService,
    type PaymentDetailsResponse,
} from '@/services/payment.service';

/**
 * What the page actually renders. `pending` is its own outcome: the provider
 * sent the customer back before the backend finished recording the payment, and
 * claiming either success or failure there would be a guess.
 */
type Outcome = 'verifying' | 'success' | 'pending' | 'failure';

/** How long we keep asking the backend before settling on `pending`. */
const VERIFY_ATTEMPTS = 5;
const VERIFY_INTERVAL_MS = 1500;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function PaymentCallbackView() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refreshCarts } = useCart();

    // Params the backend redirect carries.
    const status = searchParams.get('status');
    const paymentId = searchParams.get('paymentId');
    const orderIdParam = searchParams.get('orderId');

    const [outcome, setOutcome] = useState<Outcome>(() => {
        // Without a paymentId there is nothing to verify against, so the
        // redirect status is all we have.
        if (!paymentId) return status === 'success' ? 'success' : 'failure';
        return 'verifying';
    });
    const [payment, setPayment] = useState<PaymentDetailsResponse | null>(null);
    const [orderId, setOrderId] = useState<string | null>(orderIdParam);
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryFormHtml, setRetryFormHtml] = useState<string | null>(null);

    /**
     * The success URL alone proves nothing — the backend callback/webhook is
     * what marks a payment done, and on the online-card path the order is
     * created only after that. Reading the payment back is the only
     * authoritative answer.
     */
    useEffect(() => {
        if (!paymentId) return;

        let cancelled = false;

        (async () => {
            let latest: PaymentDetailsResponse | null = null;

            for (let attempt = 0; attempt < VERIFY_ATTEMPTS && !cancelled; attempt += 1) {
                try {
                    latest = await paymentService.getPaymentById(paymentId);
                    if (cancelled) return;

                    setPayment(latest);
                    if (latest.orderId) setOrderId(latest.orderId);

                    if (isTerminalPaymentStatus(latest.status)) {
                        setOutcome(latest.status === 'COMPLETED' ? 'success' : 'failure');
                        return;
                    }
                } catch (error) {
                    // A payment we cannot read back is not a payment we can call
                    // failed; fall through to the redirect status below.
                    console.error('Failed to verify the payment', error);
                    if (cancelled) return;
                    setOutcome(status === 'success' ? 'pending' : 'failure');
                    return;
                }

                if (attempt < VERIFY_ATTEMPTS - 1) await wait(VERIFY_INTERVAL_MS);
            }

            if (cancelled) return;
            // Still not settled: say so rather than guess. A failure redirect on
            // an unsettled payment is the provider's own verdict, so trust it.
            setOutcome(status === 'success' ? 'pending' : 'failure');
        })();

        return () => {
            cancelled = true;
        };
    }, [paymentId, status]);

    // The cart is spent once the payment goes through. A failed payment
    // deliberately keeps it so the customer can retry with the same basket.
    useEffect(() => {
        if (outcome !== 'success') return;
        refreshCarts();
    }, [outcome, refreshCarts]);

    /**
     * Sends the customer back to the provider for the same payment. The backend
     * keeps the provider URL on the payment, so this resumes the existing
     * attempt instead of creating a second one against the same cart.
     */
    const handleRetry = useCallback(async () => {
        if (!paymentId) {
            router.push('/checkout');
            return;
        }

        setIsRetrying(true);
        try {
            const details = payment ?? (await paymentService.getPaymentById(paymentId));
            const provider = details.providerResponse;
            const url = provider?.paymentPageUrl ?? provider?.paymentUrl;

            if (url) {
                window.location.assign(url);
                return;
            }
            if (provider?.checkoutFormContent) {
                setRetryFormHtml(provider.checkoutFormContent);
                return;
            }

            // The attempt is gone; the cart is still there to start a new one.
            router.push('/checkout');
        } catch (error) {
            console.error('Failed to resume the payment', error);
            router.push('/checkout');
        } finally {
            setIsRetrying(false);
        }
    }, [paymentId, payment, router]);

    if (retryFormHtml) {
        return (
            <div className="min-h-screen bg-zinc-50 py-8">
                <div className="container mx-auto max-w-2xl px-4">
                    <Card className="border-zinc-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('payment.redirecting')}
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: retryFormHtml }} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const orderHref = orderId
        ? `/orders/${orderId}${payment?.branchId ? `?branchId=${payment.branchId}${payment.brandId ? `&brandId=${payment.brandId}` : ''}` : ''}`
        : null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
            <Card className="w-full max-w-md border-zinc-200 shadow-lg">
                <CardContent className="flex flex-col items-center px-6 pt-6 pb-8 text-center">
                    {outcome === 'verifying' && (
                        <>
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
                                <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
                            </div>
                            <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('payment.verifyingTitle')}</h1>
                            <p className="text-zinc-500">{t('payment.verifyingText')}</p>
                        </>
                    )}

                    {outcome === 'success' && (
                        <>
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('payment.successTitle')}</h1>
                            <p className="mb-8 text-zinc-500">{t('payment.successText')}</p>

                            {orderId && (
                                <div className="mb-6 w-full">
                                    <ReceiptAccountPanel orderId={orderId} />
                                </div>
                            )}

                            <div className="w-full space-y-3">
                                <Button
                                    className="h-11 w-full bg-orange-600 font-bold text-white hover:bg-orange-700"
                                    onClick={() => router.push(orderHref ?? '/profile?tab=orders')}
                                >
                                    {orderHref ? t('payment.viewOrder') : t('payment.viewMyOrders')}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="h-11 w-full border-zinc-200" onClick={() => router.push('/')}>
                                    {t('payment.backToHome')}
                                </Button>
                            </div>
                        </>
                    )}

                    {outcome === 'pending' && (
                        <>
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
                                <Clock3 className="h-10 w-10 text-amber-600" />
                            </div>
                            <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('payment.pendingTitle')}</h1>
                            <p className="mb-8 text-zinc-500">{t('payment.pendingText')}</p>

                            <div className="w-full space-y-3">
                                <Button
                                    className="h-11 w-full bg-orange-600 font-bold text-white hover:bg-orange-700"
                                    onClick={() => router.push('/profile?tab=orders')}
                                >
                                    {t('payment.viewMyOrders')}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-11 w-full border-zinc-200"
                                    onClick={() => window.location.reload()}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    {t('payment.checkAgain')}
                                </Button>
                            </div>
                        </>
                    )}

                    {outcome === 'failure' && (
                        <>
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('payment.failedTitle')}</h1>
                            <p className="mb-8 text-zinc-500">{t('payment.failedText')}</p>

                            <div className="w-full space-y-3">
                                <Button
                                    className="h-11 w-full bg-orange-600 font-bold text-white hover:bg-orange-700"
                                    isLoading={isRetrying}
                                    onClick={handleRetry}
                                >
                                    {t('payment.tryAgain')}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-11 w-full border-zinc-200"
                                    onClick={() => router.push('/contact')}
                                >
                                    {t('payment.contactSupport')}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
