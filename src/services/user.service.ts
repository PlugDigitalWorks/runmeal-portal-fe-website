import { api } from '@/lib/axios';
import { User, ApiResponse } from '@/types/auth';
import { Address, CreateAddressDto, UpdateAddressDto } from '@/types/address';

export const userService = {
  async getProfile() {
    const response = await api.get<ApiResponse<User>>('/profile');
    return response.data.data;
  },

  async updateProfile(data: Partial<User>) {
    const response = await api.put<ApiResponse<User>>('/profile', data);
    return response.data.data;
  },

  async getAddresses() {
    const response = await api.get<ApiResponse<Address[]>>('/addresses');
    return response.data.data; 
  },

  async createAddress(data: CreateAddressDto) {
    const response = await api.post<ApiResponse<Address>>('/addresses', data);
    return response.data.data;
  },

  async updateAddress(id: string, data: UpdateAddressDto) {
    const response = await api.patch<ApiResponse<Address>>(`/addresses/${id}`, data);
    return response.data.data;
  },

  async deleteAddress(id: string) {
    const response = await api.delete<void>(`/addresses/${id}`);
    return response.data;
  }
};
