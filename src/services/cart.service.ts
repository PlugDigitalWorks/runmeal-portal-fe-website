import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { Cart, AddItemDto, SetQtyDto } from '@/types/cart';

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

  async applyPromotion(cartId: string, couponCode: string, branchId: string, cartTotal: number, orderType: string = 'DELIVERY') {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/apply-promotion`, {
      couponCode,
      branchId,
      cartTotal,
      orderType
    });
    return response.data.data;
  },

  async removePromotion(cartId: string) {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/remove-promotion`);
    return response.data.data;
  },

  async getAvailablePromotions(cartId: string, orderType: string = 'DELIVERY') {
    const response = await api.get<ApiResponse<any[]>>(`/carts/${cartId}/promotions/available`, {
      params: { orderType }
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
