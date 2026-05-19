export interface CartItem {
  id: string;
  productId: string;
  productName: string | null;
  price: number;
  imgUrl: string | null;
  qty: number;
  options?: CartItemOptionGroup[];
  addons?: { name: string; price?: number }[];
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
  appliedPromotion?: CartPromotion;
  items?: CartItem[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CartPromotion {
  id: string;
  name: string;
  description: string | null;
  pointType: 'PERCENTAGE' | 'FIXED';
  pointValue: number;
}

export interface AddItemDto {
  productId: string;
  qty?: number;
  options?: { groupId: string; optionId?: string; optionIds?: string[] }[];
}

export interface SetQtyDto {
  itemId: string;
  qty: number;
}
