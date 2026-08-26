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
  /**
   * The branch's JSONB settings, and the canonical home of the settings below:
   * `GET /branches/:id` and the public slug route answer with them nested here,
   * while only the nearby-search response copies them to the top level. Always
   * read them through `resolveOrderTypeSettings` / `resolvePaymentSettings`.
   */
  parameters?: BranchParameters | null;
  phoneNumber?: string;
  minBasketPrice?: number;

  /** Nearby-search only — the flattened copy of `parameters.business_hours`. */
  business_hour?: BranchParameters['business_hours'];
  /**
   * Nearby-search only — the flattened copy of `parameters.payment_settings`.
   * That endpoint substitutes empty arrays when the branch has no settings, so
   * never read this directly; use `resolvePaymentSettings`.
   */
  payment_settings?: unknown;
  /** Nearby-search only — the flattened copy of `parameters.order_type_settings`. */
  order_type_settings?: OrderTypeSettings;
}

/** Which payment methods the branch accepts. */
export interface PaymentSettings {
  isActive?: boolean;
  onlineMethods?: {
    card?: { isActive: boolean; provider?: string };
  };
  offlineMethods?: {
    cash?: { isActive: boolean };
    cardOnDelivery?: { isActive: boolean };
  };
}

/** Which fulfillment types the branch offers. */
export interface OrderTypeSettings {
  delivery?: { isActive: boolean };
  pickup?: { isActive: boolean };
  scheduledDelivery?: { isActive: boolean };
  scheduledPickup?: { isActive: boolean };
  /** QR table ordering; out of scope for the portal but sent by the backend. */
  tableOrder?: { isActive: boolean };
}

/** The branch's JSONB settings column, as far as the storefront reads it. */
export interface BranchParameters {
  payment_settings?: PaymentSettings;
  order_type_settings?: OrderTypeSettings;
  business_hours?: Record<string, {
    isOpen: boolean;
    timeSlots: { openTime: string; closeTime: string }[];
  }>;
}

/**
 * The nearby response substitutes `[]` for a missing settings object, which
 * would otherwise read as "present but everything off".
 */
const asSettings = <T>(value: unknown): T | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;

/**
 * Order type settings, wherever this particular endpoint put them.
 *
 * Returns `null` when the branch has none — which is not the same as "all off":
 * a branch predating the setting still takes delivery orders.
 */
export function resolveOrderTypeSettings(branch: Branch | null | undefined): OrderTypeSettings | null {
  if (!branch) return null;
  return asSettings<OrderTypeSettings>(branch.order_type_settings)
    ?? asSettings<OrderTypeSettings>(branch.parameters?.order_type_settings);
}

/** Payment settings, wherever this particular endpoint put them. */
export function resolvePaymentSettings(branch: Branch | null | undefined): PaymentSettings | null {
  if (!branch) return null;
  const flattened = asSettings<PaymentSettings>(branch.payment_settings);
  // The nearby response always sends the key, with empty arrays inside when the
  // branch has nothing configured — that is absence, not an empty config.
  const hasMethods = !!(asSettings(flattened?.onlineMethods) || asSettings(flattened?.offlineMethods));
  if (hasMethods) return flattened;
  return asSettings<PaymentSettings>(branch.parameters?.payment_settings);
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
