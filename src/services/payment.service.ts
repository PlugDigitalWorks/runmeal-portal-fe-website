import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';

export type PaymentMethod = 'ONLINE_CARD' | 'CASH' | 'CARD_ON_DELIVERY';
export type OrderType = 'DELIVERY' | 'PICKUP' | 'DINE_IN';

export interface PaymentInitializationResponse {
    paymentId: string;
    orderId?: string;
    checkoutFormContent?: string;
    paymentUrl?: string;
}

export const paymentService = {
    async initializePayment(
        cartId: string,
        paymentMethod: PaymentMethod = 'ONLINE_CARD',
        orderType: OrderType = 'DELIVERY',
        creditUsedAmount?: number,
        note?: string
    ) {
        const trimmedNote = note?.trim();
        const response = await api.post<ApiResponse<PaymentInitializationResponse>>('/payments/initialize', {
            cartId,
            paymentMethod,
            orderType,
            ...(creditUsedAmount && creditUsedAmount > 0 ? { creditUsedAmount } : {}),
            ...(trimmedNote ? { note: trimmedNote } : {}),
        });
        return response.data.data;
    }
};
