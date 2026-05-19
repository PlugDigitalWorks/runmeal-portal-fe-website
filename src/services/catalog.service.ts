import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { Category } from '@/types/category';
import { Product } from '@/types/product';
import { Menu } from '@/types/menu';

export const catalogService = {
  async getCategories(branchId: string, brandId?: string) {
    const headers: Record<string, string> = {
      'x-branch-id': branchId
    };
    if (brandId) {
      headers['x-brand-id'] = brandId;
    }

    const response = await api.get<ApiResponse<PaginatedResponse<Category>>>('/categories', {
      headers,
      params: { limit: 100 }
    });
    // Handle both paginated and non-paginated responses for backward compatibility
    const data = response.data.data;
    if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as PaginatedResponse<Category>).data)) {
      return (data as PaginatedResponse<Category>).data;
    }
    return Array.isArray(data) ? data : [];
  },

  async getProducts(branchId: string, itemOptions: { brandId?: string, categoryId?: string, allBranches?: boolean } = {}) {
    const headers: Record<string, string> = {
      'x-branch-id': branchId
    };
    if (itemOptions.brandId) {
      headers['x-brand-id'] = itemOptions.brandId;
    }

    const params = new URLSearchParams();
    if (itemOptions.categoryId) params.append('categoryId', itemOptions.categoryId);
    if (itemOptions.allBranches) params.append('allBranches', 'true');

    const response = await api.get<ApiResponse<PaginatedResponse<Product>>>('/products', {
      headers,
      params: { ...Object.fromEntries(params), limit: 100 }
    });
    // Handle both paginated and non-paginated responses for backward compatibility
    const data = response.data.data;
    if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as PaginatedResponse<Product>).data)) {
      return (data as PaginatedResponse<Product>).data;
    }
    return Array.isArray(data) ? data : [];
  },

  async getBrandMenu(brandId: string) {
    const response = await api.get<ApiResponse<Menu>>(`/brands/${brandId}/menu`);
    return response.data.data;
  },

  async getBranchMenu(branchId: string) {
    const response = await api.get<ApiResponse<Menu>>(`/branches/${branchId}/menu`);
    return response.data.data;
  },

  async getProduct(branchId: string, productId: string) {
    const response = await api.get<ApiResponse<Product>>(`/products/${productId}`, {
      headers: { 'x-branch-id': branchId }
    });
    return response.data.data;
  }
};

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
