import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';

export type PaymentMethod = 'ONLINE_CARD' | 'CASH' | 'CARD_ON_DELIVERY';
export type OrderType = 'DELIVERY' | 'SCHEDULED_DELIVERY' | 'PICKUP' | 'SCHEDULED_PICKUP';

export interface PaymentInitializationResponse {
    paymentId: string;
    orderId?: string;
    checkoutFormContent?: string;
    paymentUrl?: string;
}

export type PaymentStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED'
    | 'CANCELLED';

/** A payment status the backend will not move away from on its own. */
export const isTerminalPaymentStatus = (status: PaymentStatus | string | null | undefined) =>
    status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'
    || status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED';

export interface PaymentDetailsResponse {
    id: string;
    status?: PaymentStatus | string;
    /** Null until the provider confirms — the order is created only then. */
    orderId?: string | null;
    branchId?: string;
    brandId?: string;
    amount?: number | string;
    providerResponse: {
        paymentPageUrl?: string;
        paymentUrl?: string;
        checkoutFormContent?: string;
    } | null;
}

export interface InitializePaymentInput {
    cartId: string;
    /** Part of the branch-scoped request contract; the backend re-derives it from the cart. */
    branchId?: string | null;
    paymentMethod?: PaymentMethod;
    orderType?: OrderType;
    /** Opaque backend-issued slot value, valid only for scheduled order types. */
    scheduledFor?: string;
    creditUsedAmount?: number;
    note?: string;
}

export const paymentService = {
    /** Used by the callback page to verify a payment instead of trusting the query string. */
    async getPaymentById(paymentId: string) {
        const response = await api.get<ApiResponse<PaymentDetailsResponse>>(
            `/payments/${encodeURIComponent(paymentId)}`,
        );
        return response.data.data;
    },

    /**
     * Starts a payment for a cart. On the online-card path the order does not
     * exist yet; the backend creates it once the provider confirms payment,
     * which is why the callback has to verify rather than assume.
     */
    async initializePayment({
        cartId,
        branchId,
        paymentMethod = 'ONLINE_CARD',
        orderType = 'DELIVERY',
        scheduledFor,
        creditUsedAmount,
        note,
    }: InitializePaymentInput) {
        const response = await api.post<ApiResponse<PaymentInitializationResponse>>(
            '/payments/initialize',
            {
                cartId,
                paymentMethod,
                orderType,
                ...((orderType === 'SCHEDULED_DELIVERY' || orderType === 'SCHEDULED_PICKUP') && scheduledFor
                    ? { scheduledFor }
                    : {}),
                creditUsedAmount: creditUsedAmount && creditUsedAmount > 0 ? creditUsedAmount : 0,
                ...(note?.trim() ? { note: note.trim() } : {}),
            },
            branchId ? { headers: { 'x-branch-id': branchId } } : {},
        );
        return response.data.data;
    }
};
