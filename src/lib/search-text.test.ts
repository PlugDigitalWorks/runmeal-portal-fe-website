import { describe, expect, it } from 'vitest';

import { foldSearchText, matchesSearch, readSearchTerm, writeSearchTerm } from './search-text';

describe('foldSearchText', () => {
  it('ignores case and accents the way the API does', () => {
    expect(foldSearchText('Döner')).toBe('doner');
    expect(foldSearchText('ÇİĞ  Köfte')).toBe('cig kofte');
    expect(foldSearchText('Acılı')).toBe('acili');
  });

  it('matches folded text', () => {
    expect(matchesSearch('cig kofte', ['Adana', 'Çiğ Köfte Dürüm'])).toBe(true);
    expect(matchesSearch('pizza', ['Döner'])).toBe(false);
  });
});

describe('search term in the URL', () => {
  it('round-trips the term next to other parameters', () => {
    const query = writeSearchTerm('tags=a,b', '  çiğ köfte ');
    expect(readSearchTerm(new URLSearchParams(query))).toBe('çiğ köfte');
    expect(new URLSearchParams(query).get('tags')).toBe('a,b');
  });

  it('removes the term when cleared', () => {
    expect(writeSearchTerm('q=pizza&tags=a', '')).toBe('tags=a');
  });

  it('ignores a term too short to search', () => {
    expect(readSearchTerm(new URLSearchParams('q=a'))).toBe('');
  });
});
