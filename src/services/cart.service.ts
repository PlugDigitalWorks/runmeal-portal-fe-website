import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import {
  AddItemDto,
  ApplyPromotionInput,
  Cart,
  CartPromotion,
  RemovePromotionInput,
  SetQtyDto,
} from '@/types/cart';

export const cartService = {
  async getAllCarts() {
    const response = await api.get<ApiResponse<Cart[]>>('/carts');
    return response.data.data;
  },

  async getCart(cartId: string) {
    const response = await api.get<ApiResponse<Cart>>(`/carts/${cartId}`);
    return response.data.data;
  },

  async addItem(data: AddItemDto, branchId?: string) {
    const config = branchId ? { headers: { 'x-branch-id': branchId } } : {};
    const response = await api.post<ApiResponse<Cart>>('/carts/items', data, config);
    return response.data.data;
  },

  async setQty(data: SetQtyDto, branchId?: string) {
    const config = branchId ? { headers: { 'x-branch-id': branchId } } : {};
    const response = await api.patch<ApiResponse<Cart>>('/carts/items/qty', data, config);
    return response.data.data;
  },

  async removeItem(itemId: string, branchId?: string) {
    const config = branchId ? { headers: { 'x-branch-id': branchId } } : {};
    const response = await api.delete<ApiResponse<Cart | { message: string }>>(`/carts/items/${itemId}`, config);
    return response.data.data;
  },

  /** Internal Runmeal coupons and Rekonect campaigns, in one list. */
  async getAvailablePromotions(cartId: string, orderType: string = 'DELIVERY') {
    const response = await api.get<ApiResponse<CartPromotion[]>>(`/carts/${cartId}/promotions/available`, {
      params: { orderType }
    });
    return response.data.data ?? [];
  },

  /** Applies one promotion of either provider. The response is the full, re-priced cart. */
  async applyPromotion(cartId: string, input: ApplyPromotionInput, orderType: string = 'DELIVERY') {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/promotions/apply`, {
      type: input.type,
      promotionCode: input.promotionCode,
      orderType
    });
    return response.data.data;
  },

  /**
   * Removes one promotion, or every promotion of that provider when
   * `promotionCode` is omitted. The response is the full, re-priced cart.
   */
  async removePromotion(cartId: string, input: RemovePromotionInput) {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/promotions/remove`, {
      type: input.type,
      ...(input.promotionCode ? { promotionCode: input.promotionCode } : {})
    });
    return response.data.data;
  },

  async clearCart(cartId: string) {
    const response = await api.delete<ApiResponse<{ message: string }>>('/carts', {
      data: { cartId }
    });
    return response.data.data;
  },

  async deactivateCart(cartId: string) {
    const response = await api.patch<ApiResponse<{ message: string }>>('/carts/deactivate', { cartId });
    return response.data.data;
  },

  async getCartItems(cartId: string) {
    const response = await api.get<ApiResponse<any[]>>('/carts/items', {
      params: { cartId }
    });
    return response.data.data;
  }
};
