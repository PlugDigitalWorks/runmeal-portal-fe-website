import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { Branch } from '@/types/branch';

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
  }
};
