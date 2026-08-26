import {
  CartItem,
  CartProductReward,
  CartPromotion,
  LoyaltyProviderType,
  ProductRewardScope,
  PRODUCT_REWARD_ITEM_REQUIRED,
} from '@/types/cart';

/** A campaign row that is a repeatable product reward rather than a plain coupon. */
export const getProductReward = (promotion: Pick<CartPromotion, 'productReward'>): CartProductReward | null =>
  promotion.productReward ?? null;

export interface ProductRewardProgress {
  /** Qualifying items bought so far. */
  earned: number;
  /** Items needed for the next reward — the right hand side of "12 / 20". */
  target: number;
  /** Items still missing for the next reward. */
  remaining: number;
  /** 0–100, for the progress bar. */
  percent: number;
  /** Earned but unspent rewards. */
  availableRewards: number;
}

/**
 * Turns the backend counters into what the progress row renders.
 *
 * The next target is derived as `qualifyingQuantity + remainingQuantity` rather
 * than from the threshold: the backend already accounts for rewards that were
 * spent in earlier orders, so 12 bought against a threshold of 10 reports 8
 * remaining and must read "12 / 20", not "12 / 10".
 */
export function resolveProductRewardProgress(reward: CartProductReward | null | undefined): ProductRewardProgress | null {
  if (!reward) return null;

  const earned = Math.max(0, Number(reward.qualifyingQuantity ?? 0));
  const remaining = Math.max(0, Number(reward.remainingQuantity ?? 0));
  const threshold = Math.max(0, Number(reward.productQuantityThreshold ?? 0));
  const availableRewards = Math.max(0, Number(reward.availableRewards ?? 0));

  // `remaining` is 0 on a fully earned reward, which would leave the bar with
  // no scale — fall back to the threshold so it still reads as complete.
  const target = earned + remaining > 0 ? earned + remaining : threshold;
  if (target <= 0) return null;

  return {
    earned,
    target,
    remaining,
    percent: Math.min(100, Math.round((earned / target) * 100)),
    availableRewards,
  };
}

/** The eligible item the customer has to add before the reward can be applied. */
export function resolveRewardTargetName(reward: CartProductReward | null | undefined): string | null {
  if (!reward) return null;
  if (reward.rewardScope === ProductRewardScope.PRODUCT) return reward.rewardProductName ?? null;
  return reward.rewardCategoryName ?? reward.rewardProductName ?? null;
}

/**
 * Deep link to the menu that lands the customer on the reward's fixed product
 * or category, so `PRODUCT_REWARD_ITEM_REQUIRED` has somewhere to send them.
 * `basePath` is the branch menu route the cart belongs to — the portal serves
 * many branches, so the caller has to supply it.
 */
export function buildRewardMenuHref(
  reward: CartProductReward | null | undefined,
  basePath = '/',
  extraParams?: Record<string, string>,
): string | null {
  if (!reward) return null;

  const params = new URLSearchParams(extraParams);
  if (reward.rewardProductId) {
    params.set('product', reward.rewardProductId);
  } else if (reward.rewardCategoryId) {
    params.set('category', reward.rewardCategoryId);
  } else {
    return null;
  }

  return `${basePath}?${params.toString()}`;
}

/** The campaign is blocked purely because no eligible item is in the cart. */
export const needsRewardItem = (promotion: Pick<CartPromotion, 'applicable' | 'unapplicableReason'>) =>
  !promotion.applicable && promotion.unapplicableReason === PRODUCT_REWARD_ITEM_REQUIRED;

/**
 * The cart lines a product reward may be spent on.
 *
 * The unit of choice is the cart line, not the product: the same coffee added
 * twice with different options is two lines, and the reward lands on exactly
 * one of them.
 *
 * A `CATEGORY` scoped reward matches on `item.categoryId`. Responses that
 * predate that field carry no category on any line, and filtering would then
 * hide every candidate — in that case the whole cart is offered and the backend
 * rejects an out-of-scope pick with `LOYALTY_PRODUCT_REWARD_ITEM_REQUIRED`.
 */
export function resolveEligibleRewardItems(
  reward: CartProductReward | null | undefined,
  items: CartItem[] | null | undefined,
): CartItem[] {
  if (!reward) return [];

  const active = (items ?? []).filter((item) => !!item.id && Number(item.qty ?? 0) >= 1);
  if (reward.rewardScope === ProductRewardScope.PRODUCT) {
    if (!reward.rewardProductId) return [];
    return active.filter((item) => item.productId === reward.rewardProductId);
  }

  if (!reward.rewardCategoryId) return [];
  const hasCategories = active.some((item) => !!item.categoryId);
  if (!hasCategories) return active;
  return active.filter((item) => item.categoryId === reward.rewardCategoryId);
}

/** What one unit of this line costs before options — the reward's exact value. */
export const resolveRewardItemPrice = (item: CartItem) => Number(item.basePrice ?? item.price ?? 0);

/**
 * Applying this campaign needs a cart line from the customer first. Only
 * internal product reward campaigns do; coupons and external providers apply
 * straight away.
 */
export const requiresRewardSelection = (promotion: Pick<CartPromotion, 'type' | 'productReward'>) =>
  promotion.type === LoyaltyProviderType.INTERNAL && !!getProductReward(promotion);
