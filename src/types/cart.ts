export interface CartItem {
  id: string;
  productId: string;
  productName: string | null;
  price: number;
  imgUrl: string | null;
  qty: number;
  options?: CartItemOptionGroup[];
  addons?: { name: string; price?: number }[];
  note?: string | null;
}

export interface CartItemOptionGroup {
  type: string;
  groupId: string;
  groupName: string;
  selections: CartItemOptionSelection[];
}

export interface CartItemOptionSelection {
  action: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface Cart {
  id?: string;
  cartId?: string;
  brandId: string;
  branchId: string;
  userId: string;
  totalCartPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  /** Single source of truth for every promotion currently applied to the cart. */
  appliedPromotions?: AppliedPromotion[];
  items?: CartItem[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Loyalty provider that owns a promotion. Absent/null means an internal Runmeal promotion. */
export const REKONECT_PROVIDER = 'REKONECT';

export interface AppliedPromotion {
  id: string;
  name: string;
  description?: string | null;
  creditType?: string | null;
  creditValue?: number | null;
  externalProvider?: string | null;
}

export interface PromotionAssetDetails {
  image?: string | null;
}

export interface AvailablePromotionDetails {
  id: string;
  name: string;
  description?: string | null;
  /** Internal Runmeal promotions are applied by coupon code; external ones by `id`. */
  couponCode?: string | null;
  creditType?: string | null;
  creditValue?: number | null;
  externalProvider?: string | null;
  status?: string | null;
  raw?: { assetDetails?: PromotionAssetDetails | null } | null;
}

export interface AvailablePromotion {
  applicable: boolean;
  unapplicableReason?: string;
  promotion: AvailablePromotionDetails;
}

export const isExternalPromotion = (
  promotion: { externalProvider?: string | null } | null | undefined,
) => promotion?.externalProvider === REKONECT_PROVIDER;

/** Stable id for a cart across the `id` / `cartId` response variants. */
export const getCartId = (cart: Cart | null | undefined) => cart?.cartId || cart?.id || '';

export const getPromotionImage = (promotion: AvailablePromotionDetails) => {
  const image = promotion.raw?.assetDetails?.image;
  return typeof image === 'string' && image.trim() ? image : null;
};

export interface AddItemDto {
  productId: string;
  qty?: number;
  options?: { groupId: string; optionId?: string; optionIds?: string[] }[];
  note?: string;
}

export interface SetQtyDto {
  itemId: string;
  qty: number;
}
