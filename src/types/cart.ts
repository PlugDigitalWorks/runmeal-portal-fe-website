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
  appliedPromotions?: CartPromotion[];
  items?: CartItem[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Loyalty provider that owns a promotion. */
export enum LoyaltyProviderType {
  INTERNAL = 'INTERNAL',
  REKONECT = 'REKONECT',
}

/**
 * The one promotion shape the backend uses, both in the available list and in
 * the cart's `appliedPromotions`.
 *
 * `promotionCode` is a Runmeal coupon code for INTERNAL and a Rekonect asset key
 * for REKONECT — the difference is the backend's business, we only echo `type`
 * and `promotionCode` back.
 */
export interface CartPromotion {
  type: LoyaltyProviderType;
  promotionCode: string;
  name: string | null;
  description: string | null;
  creditType: string;
  creditValue: number;
  imageUrl: string | null;
  applicable: boolean;
  unapplicableReason: string | null;
}

export interface ApplyPromotionInput {
  type: LoyaltyProviderType;
  promotionCode: string;
}

/** Omitting `promotionCode` removes every promotion belonging to that provider. */
export interface RemovePromotionInput {
  type: LoyaltyProviderType;
  promotionCode?: string;
}

/** Identity of a promotion across the available list and the applied list. */
export const promotionKey = (promotion: Pick<CartPromotion, 'type' | 'promotionCode'>) =>
  `${promotion.type}:${promotion.promotionCode}`;

/**
 * Balance the cart's branch actually lets the user spend, resolved by its loyalty
 * provider. Not the same thing as the account-wide Runmeal credit balance.
 */
export interface CartLoyaltyWallet {
  provider: LoyaltyProviderType;
  /** e.g. `points`; copy comes from i18n with the raw value as fallback. */
  balanceType: string;
  balance: number;
  currency: string;
  usable: boolean;
}

/** Stable id for a cart across the `id` / `cartId` response variants. */
export const getCartId = (cart: Cart | null | undefined) => cart?.cartId || cart?.id || '';

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
