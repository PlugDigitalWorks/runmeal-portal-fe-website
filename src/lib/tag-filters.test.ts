import { describe, expect, it } from 'vitest';

import { readTagFilter, writeTagFilter } from './tag-filters';

describe('tag filter in the URL', () => {
  it('round-trips the selected tag ids', () => {
    const ids = ['3f1c0a2e-0000-4000-8000-000000000001', '3f1c0a2e-0000-4000-8000-000000000002'];

    const query = writeTagFilter('', ids);

    expect(query).toBe(`tags=${encodeURIComponent(ids.join(','))}`);
    expect(readTagFilter(new URLSearchParams(query))).toEqual(ids);
  });

  it('keeps the other query parameters', () => {
    const query = writeTagFilter('utm_source=mail&tags=old', ['a', 'b']);
    const params = new URLSearchParams(query);

    expect(params.get('utm_source')).toBe('mail');
    expect(readTagFilter(params)).toEqual(['a', 'b']);
  });

  it('drops the parameter when nothing is selected', () => {
    expect(writeTagFilter('tags=a,b&page=2', [])).toBe('page=2');
  });

  it('ignores blanks and repeats in a hand-edited URL', () => {
    expect(readTagFilter(new URLSearchParams('tags=a,,b, a ,'))).toEqual(['a', 'b']);
    expect(readTagFilter(new URLSearchParams(''))).toEqual([]);
  });
});
