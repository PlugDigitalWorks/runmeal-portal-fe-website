import { api } from "@/lib/axios";
import { ApiResponse } from "@/types/auth";

export interface CreateOrderDto {
  cartId: string;
}

export interface Order {
  id: string;
  orderNumber?: string | null;
  orderNo?: string | null;
  code?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  brandId: string;
  branchId: string;
  branchName?: string | null;
  branchAddressText?: string | null;
  branchLogoUrl?: string | null;
  userId: string;
  cartId: string;
  totalPrice: string;
  taxAmount: string;
  subtotal?: string | number | null;
  subTotal?: string | number | null;
  deliveryFee?: string | number | null;
  discountAmount?: string | number | null;
  couponCode?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  status: string;
  isActive: boolean;
  userAddressId: string;
  // Address display fields (from formatted response)
  addressText?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  userFirstName?: string;
  userLastName?: string;
}
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  // Additional fields from formatted response
  basePrice?: number;
  optionsTotal?: number;
  lineTotal?: number;
  options?: Array<{
    groupId?: string;
    groupName?: string;
    name?: string;
    selectedOptions?: Array<{
      optionId?: string;
      optionName?: string;
      name?: string;
      priceDelta?: number | string | null;
      price?: number | string | null;
    }>;
    selections?: Array<{
      optionId?: string;
      optionName?: string;
      name?: string;
      priceDelta?: number | string | null;
      price?: number | string | null;
    }>;
  }> | null;
  addons?: Array<{
    id?: string;
    addonId?: string;
    name?: string;
    addonName?: string;
    price?: number | string | null;
    priceDelta?: number | string | null;
    quantity?: number;
  }> | null;
  note?: string | null;
  qty?: number;
}

export interface OrderDetails extends Order {
  items: OrderItem[];
}

export const orderService = {
  async getMyOrders() {
    const response =
      await api.get<ApiResponse<PaginatedResponse<Order>>>("/orders/customer");
    const data = response.data.data;
    if (
      data &&
      typeof data === "object" &&
      "data" in data &&
      Array.isArray((data as PaginatedResponse<Order>).data)
    ) {
      return (data as PaginatedResponse<Order>).data;
    }
    return Array.isArray(data) ? data : [];
  },

  async getOrderById(orderId: string, branchId: string, brandId: string) {
    const response = await api.get<ApiResponse<OrderDetails>>(
      `/orders/${orderId}`,
      {
        headers: {
          "x-branch-id": branchId,
          "x-brand-id": brandId,
        },
      },
    );
    return response.data.data;
  },
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
