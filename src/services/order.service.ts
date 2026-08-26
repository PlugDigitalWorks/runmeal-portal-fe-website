import { api } from "@/lib/axios";
import { ApiResponse } from "@/types/auth";
import { CartProductReward } from "@/types/cart";

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
  note?: string | null;
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
  /** How the order is fulfilled; absent on rows predating scheduled orders. */
  orderType?: string | null;
  /** Present on scheduled orders only, as the backend formatted them. */
  scheduledFor?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  creditUsedAmount?: string | number | null;
  currency?: string | null;
  currencySymbol?: string | null;
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
  /**
   * What a promotion took off this line, and what is left to pay. A product
   * reward discounts one unit's base price on a single line, so these are
   * absent on every other item of the order.
   */
  discountAmount?: number | string | null;
  finalLineTotal?: number | string | null;
}

/**
 * The internal promotion the order was placed with, frozen at order time. The
 * campaign it came from may have ended or changed since, which is exactly why
 * the order carries its own copy.
 */
export interface OrderInternalPromotionSnapshot {
  promotionCode?: string | null;
  name?: string | null;
  description?: string | null;
  discountAmount?: number | string | null;
  productReward?: CartProductReward | null;
}

export interface OrderDetails extends Order {
  items: OrderItem[];
  /** Sent as a single snapshot; tolerated as a list for forward compatibility. */
  internalPromotionSnapshot?: OrderInternalPromotionSnapshot | OrderInternalPromotionSnapshot[] | null;
}

/** Normalizes the snapshot field into the list the order detail view renders. */
export const toPromotionSnapshots = (
  snapshot: OrderDetails["internalPromotionSnapshot"],
): OrderInternalPromotionSnapshot[] => {
  if (!snapshot) return [];
  return Array.isArray(snapshot) ? snapshot.filter(Boolean) : [snapshot];
};

export type ReceiptDeliveryStatus = "sent" | "already_sent" | "queued";
export type ReceiptOtpStatus = "sent" | "not_required" | "failed";

export interface ReceiptAccountResponse {
  receiptStatus: ReceiptDeliveryStatus;
  otpStatus: ReceiptOtpStatus;
  otpExpiresInSeconds: number | null;
}

export const orderService = {
  async getMyOrders(branchId?: string | null) {
    const response = await api.get<ApiResponse<PaginatedResponse<Order>>>(
      "/orders/customer",
      branchId ? { headers: { "x-branch-id": branchId } } : {},
    );
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

  /**
   * Finds the order a cart was already turned into.
   *
   * On the online-card path the order is created only after the provider
   * confirms, and the formatted order view drops `cartId` — so the lookup goes
   * through the entity-shaped customer list, newest first.
   */
  async findOrderByCartId(cartId: string, branchId?: string | null) {
    const orders = await orderService.getMyOrders(branchId);
    return orders.find((order) => order.cartId === cartId) ?? null;
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

  /** Asks the backend to e-mail the receipt and open a receipt account. */
  async requestReceiptAccount(orderId: string, email: string) {
    const response = await api.post<ApiResponse<ReceiptAccountResponse>>(
      `/customer/orders/${encodeURIComponent(orderId)}/receipt-account`,
      { email, acceptReceiptAndAccount: true },
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
