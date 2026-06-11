import { Category } from './category';
import { Product } from './product';

/** A category as returned by the menu endpoints, with its products nested. */
export interface MenuCategory extends Category {
    products: Product[];
}

export interface Menu {
    branchId?: string;
    brandId: string;
    categories: MenuCategory[];
}
