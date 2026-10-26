import { describe, expect, it } from 'vitest';

import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { ProductTag } from '@/types/tag';
import { buildMenuSections, collectProductTags, uniqueTags } from './menu-tags';

const productTag = (id: string, sortOrder: number, source: ProductTag['source'] = 'product'): ProductTag => ({
  id,
  kind: 'product',
  group: null,
  slug: id,
  name: { tr: id, en: id },
  icon: null,
  sortOrder,
  source,
});

const vegan = productTag('vegan', 1);
const spicy = productTag('spicy', 2);

const product = (id: string, categoryId: string, tags: ProductTag[] = []): Product => ({
  id,
  categoryId,
  branchId: 'branch-1',
  name: id,
  description: '',
  price: 10,
  isActive: true,
  tags,
});

const categories: Category[] = [
  { id: 'burgers', name: 'Burgers' },
  { id: 'salads', name: 'Salads' },
  { id: 'drinks', name: 'Drinks' },
];

const products = [
  product('beef', 'burgers', [spicy]),
  product('garden', 'burgers', [vegan, spicy]),
  product('caesar', 'salads', [{ ...vegan, source: 'category' }]),
  product('cola', 'drinks'),
];

describe('buildMenuSections', () => {
  it('groups every product under its category', () => {
    const sections = buildMenuSections(categories, products);

    expect(sections.map((s) => [s.category.id, s.products.map((p) => p.id)])).toEqual([
      ['burgers', ['beef', 'garden']],
      ['salads', ['caesar']],
      ['drinks', ['cola']],
    ]);
  });

  it('keeps only products carrying the tag, own or inherited, and hides empty categories', () => {
    const sections = buildMenuSections(categories, products, { tagId: 'vegan' });

    expect(sections.map((s) => [s.category.id, s.products.map((p) => p.id)])).toEqual([
      ['burgers', ['garden']],
      ['salads', ['caesar']],
    ]);
  });

  it('narrows to one category as well', () => {
    const sections = buildMenuSections(categories, products, { categoryId: 'burgers', tagId: 'vegan' });

    expect(sections).toHaveLength(1);
    expect(sections[0].products.map((p) => p.id)).toEqual(['garden']);
  });
});

describe('collectProductTags', () => {
  it('lists each tag some product carries once, in display order', () => {
    expect(collectProductTags(products).map((t) => t.id)).toEqual(['vegan', 'spicy']);
  });
});

describe('uniqueTags', () => {
  it('keeps the first of a repeated tag', () => {
    const tags = uniqueTags([vegan, { ...vegan, source: 'category' }, spicy]);

    expect(tags).toEqual([vegan, spicy]);
  });
});
