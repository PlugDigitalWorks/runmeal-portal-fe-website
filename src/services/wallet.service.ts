import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';

export interface WalletBalance {
    balance: number;
}

export const walletService = {
    async getBalance() {
        const response = await api.get<ApiResponse<WalletBalance>>('/loyalty/credit/balance');
        return response.data.data;
    }
};
