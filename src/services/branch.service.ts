import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import type {
  Branch,
  BranchAvailabilityResponse,
  FulfillmentSlotsResponse,
  ScheduledOrderType,
} from '@/types/branch';

export const branchService = {
  async getNearbyBranches(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    
    const queryString = params.toString();
    const url = `/branches/nearby${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<ApiResponse<Branch[]>>(url);
    return response.data.data;
  },

  async getBranchDetails(branchId: string) {
    const response = await api.get<ApiResponse<Branch>>(`/branches/${branchId}`);
    return response.data.data;
  },

  async getBranchBySlugs(brandSlug: string, branchSlug: string) {
    const response = await api.get<ApiResponse<Branch>>(
      `/public/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`
    );
    return response.data.data;
  },

  /** Whether the branch can take an order right now (hours, manual close). */
  async getAvailability(branchId: string) {
    const response = await api.get<ApiResponse<BranchAvailabilityResponse>>(
      `/branches/${encodeURIComponent(branchId)}/availability`,
    );
    return response.data.data;
  },

  /**
   * Slots a scheduled order may be placed for. `slot.value` is opaque and must
   * be echoed back to `initializePayment` untouched.
   */
  async getFulfillmentSlots(branchId: string, orderType: ScheduledOrderType) {
    const response = await api.get<ApiResponse<FulfillmentSlotsResponse>>(
      `/branches/${encodeURIComponent(branchId)}/fulfillment-slots`,
      { params: { orderType } },
    );
    return response.data.data;
  }
};
