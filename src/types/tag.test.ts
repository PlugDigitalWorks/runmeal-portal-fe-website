import { describe, expect, it } from 'vitest';

import { sortRestaurantTags, tagName, type Tag } from './tag';

const tag = (overrides: Partial<Tag>): Tag => ({
  id: 'tag',
  kind: 'restaurant',
  group: 'cuisine',
  slug: 'tag',
  name: { tr: 'Etiket', en: 'Tag' },
  icon: null,
  sortOrder: 0,
  ...overrides,
});

describe('tagName', () => {
  const vegan = tag({ name: { tr: 'Vegan seçenekler', en: 'Vegan options' } });

  it('picks the name matching the interface language', () => {
    expect(tagName(vegan, 'tr')).toBe('Vegan seçenekler');
    expect(tagName(vegan, 'en')).toBe('Vegan options');
    expect(tagName(vegan, 'en-GB')).toBe('Vegan options');
  });

  it('falls back to the other language when one is missing', () => {
    expect(tagName(tag({ name: { tr: 'Teras', en: '' } }), 'en')).toBe('Teras');
    expect(tagName(tag({ name: { tr: '', en: 'Terrace' } }), 'tr')).toBe('Terrace');
  });
});

describe('sortRestaurantTags', () => {
  it('puts cuisine tags first, each group in its own order', () => {
    const sorted = sortRestaurantTags([
      tag({ id: 'terrace', group: 'feature', sortOrder: 0 }),
      tag({ id: 'pizza', group: 'cuisine', sortOrder: 2 }),
      tag({ id: 'kids', group: 'feature', sortOrder: 1 }),
      tag({ id: 'burger', group: 'cuisine', sortOrder: 1 }),
    ]);

    expect(sorted.map((t) => t.id)).toEqual(['burger', 'pizza', 'terrace', 'kids']);
  });
});
