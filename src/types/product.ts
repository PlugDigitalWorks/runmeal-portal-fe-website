export interface Product {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  categoryId: string;
  brandId?: string;
  branchId: string;
  name: string;
  description: string;
  tags?: string[];
  price: number | string;
  discountedPrice?: number | string | null;
  image?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  addonIds?: string[] | null;
  addons?: ProductAddon[];
  options?: ProductOption[]; // Legacy
  optionGroups?: OptionGroup[]; // New dynamic options
}

export enum ProductOptionGroupType {
  SINGLE = 'SINGLE',
  MULTI = 'MULTI',
  VARIANT = 'VARIANT',
  INGREDIENT = 'INGREDIENT',
}

export interface OptionGroup {
  id: string;
  name: string;
  type: ProductOptionGroupType;
  isRequired: boolean;
  minSelections?: number | null;
  maxSelections?: number | null;
  options: OptionGroupItem[];
  sortOrder?: number;
}

export interface OptionGroupItem {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface ProductOptionValue {
  id: string;
  name: string;
  priceModifier: number;
  isDefault?: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  isRequired: boolean;
  isMultiple: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  values: ProductOptionValue[];
}
