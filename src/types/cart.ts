export interface CartItem {
  id: string;
  productId: string;
  productName: string | null;
  /** Category the product belongs to — how a `CATEGORY` scoped reward matches a line. */
  categoryId?: string | null;
  categoryName?: string | null;
  price: number;
  /**
   * Unit price without options. A product reward pays exactly this much for one
   * unit, which is why the picker prices the lines with it. Older responses omit
   * it and fall back to `price`.
   */
  basePrice?: number;
  note?: string | null;
  imgUrl: string | null;
  qty: number;
  options?: CartItemOptionGroup[];
  addons?: { name: string; price?: number }[];
  /**
   * Line level pricing, sent by the backend once a promotion can land on a
   * single line (product rewards). `lineTotal` is what the line costs before
   * the reward, `finalLineTotal` after it. Older responses omit all three, so
   * every reader falls back to `price * qty`.
   */
  lineTotal?: number;
  discountAmount?: number;
  finalLineTotal?: number;
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
  /** Only `PRODUCT_COUNT_BASED` campaigns carry this; everything else omits it. */
  productReward?: CartProductReward | null;
}

/** Which items a repeatable product reward may be spent on. */
export enum ProductRewardScope {
  CATEGORY = 'CATEGORY',
  PRODUCT = 'PRODUCT',
}

/**
 * Repeatable product reward ("every 10 coffees earns one coffee").
 *
 * The same field name carries two payloads: the available list sends the
 * progress half (how far the customer is, what may be redeemed), and the cart's
 * `appliedPromotions` sends the applied half (which line the reward landed on).
 * Both halves are optional here so one type covers both without the UI having
 * to know which list a row came from.
 */
export interface CartProductReward {
  // Progress — available promotions list.
  /** Qualifying items bought so far, counted across orders, not this cart. */
  qualifyingQuantity?: number;
  /** How many qualifying items one reward costs. */
  productQuantityThreshold?: number;
  /** Items still needed for the next reward. */
  remainingQuantity?: number;
  /** Rewards earned and not spent yet. */
  availableRewards?: number;
  rewardScope?: ProductRewardScope | string | null;
  rewardCategoryId?: string | null;
  rewardCategoryName?: string | null;
  rewardProductId?: string | null;
  rewardProductName?: string | null;
  /**
   * The reward covers one unit's base price only — options, size upgrades and
   * extras stay payable, which is why the discount never equals the line total.
   */
  basePriceOnly?: boolean;

  // Applied — cart `appliedPromotions`. The line is the one the customer picked
  // and the client sent as `selectedCartItemId`; the backend echoes it back.
  appliedCartItemId?: string | null;
  appliedProductId?: string | null;
  appliedAmount?: number | null;
}

/** Reason codes a product reward campaign reports on the available list. */
export const PRODUCT_REWARD_NOT_EARNED = 'PRODUCT_REWARD_NOT_EARNED';
export const PRODUCT_REWARD_ITEM_REQUIRED = 'PRODUCT_REWARD_ITEM_REQUIRED';

export interface ApplyPromotionInput {
  type: LoyaltyProviderType;
  promotionCode: string;
  /**
   * The cart line the customer spends a product reward on. Mandatory for an
   * internal `PRODUCT_COUNT_BASED` campaign, ignored by every other promotion.
   * It is a cart item id, not a product id: the same product can sit on several
   * lines with different options and only one of them gets the discount.
   */
  selectedCartItemId?: string | null;
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
