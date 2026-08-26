export interface Branch {
  id: string;
  name: string;
  slug?: string;
  brandSlug?: string | null;
  addressText: string;
  deliveryRadiusM: number;
  locationGeog: {
    type: 'Point';
    coordinates: number[]; // [longitude, latitude]
  };
  distanceM?: number;
  brandId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  countryCode: string;
  province: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNumber: string | null;
  apartmentNumber: string | null;
  postalCode: string | null;
  isActive: boolean;
  logoUrl?: string | null;
  bannerUrls?: string[];
  parameters?: Record<string, unknown> | null;
  phoneNumber?: string;
  minBasketPrice?: number;

  business_hour?: Record<string, {
    isOpen: boolean;
    timeSlots: { openTime: string; closeTime: string }[];
  }>;
  /**
   * Which payment methods the branch actually accepts. Absent on older branch
   * payloads, so every reader falls back to "online card only".
   */
  payment_settings?: {
    isActive: boolean;
    onlineMethods?: {
      card?: { isActive: boolean; provider?: string };
    };
    offlineMethods?: {
      cash?: { isActive: boolean };
      cardOnDelivery?: { isActive: boolean };
    };
  };
  /**
   * Which fulfillment types the branch offers. Absent on older payloads, in
   * which case only immediate delivery is assumed.
   */
  order_type_settings?: {
    delivery?: { isActive: boolean };
    pickup?: { isActive: boolean };
    scheduledDelivery?: { isActive: boolean };
    scheduledPickup?: { isActive: boolean };
    /** QR table ordering; out of scope for the portal but sent by the backend. */
    tableOrder?: { isActive: boolean };
  };
}

export type AvailabilityReason =
  | 'BRANCH_INACTIVE'
  | 'MANUALLY_CLOSED'
  | 'OUTSIDE_BUSINESS_HOURS'
  | null;

export interface BranchAvailabilityResponse {
  canAcceptOrders: boolean;
  reason: AvailabilityReason;
}

export type ScheduledOrderType = 'SCHEDULED_DELIVERY' | 'SCHEDULED_PICKUP';

export interface FulfillmentSlot {
  label: string;
  /** Opaque backend value. Never parse or normalize this in the browser. */
  value: string;
}

export interface FulfillmentSlotsResponse {
  orderType: ScheduledOrderType;
  available: boolean;
  dates: Array<{
    date: string;
    slots: FulfillmentSlot[];
  }>;
}
