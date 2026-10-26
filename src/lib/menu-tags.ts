import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { Tag } from '@/types/tag';

export interface MenuSection {
  category: Category;
  products: Product[];
}

/** Tags without repeats, keeping the first of each (a product's own before inherited). */
export function uniqueTags<T extends Tag>(tags: T[] | undefined): T[] {
  const seen = new Set<string>();
  return (tags ?? []).filter((tag) => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
}

export const productHasTag = (product: Product, tagId: string) =>
  !!product.tags?.some((tag) => tag.id === tagId);

/** The tags any product carries, for the menu's quick filters, in display order. */
export function collectProductTags(products: Product[]): Tag[] {
  return uniqueTags(products.flatMap((product) => product.tags ?? [])).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * The menu as category sections, narrowed to one category and/or to products
 * carrying one tag. Sections left without products are dropped.
 */
export function buildMenuSections(
  categories: Category[],
  products: Product[],
  { categoryId, tagId }: { categoryId?: string; tagId?: string } = {},
): MenuSection[] {
  return categories
    .filter((category) => !categoryId || category.id === categoryId)
    .map((category) => ({
      category,
      products: products.filter(
        (product) => product.categoryId === category.id && (!tagId || productHasTag(product, tagId)),
      ),
    }))
    .filter((section) => section.products.length > 0);
}
