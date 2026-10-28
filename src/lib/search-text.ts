/** Query parameter holding the restaurant search term. */
export const SEARCH_PARAM = 'q';

/** The portal search accepts terms of this many characters, after trimming. */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 50;

/** The term from the URL, or '' when it is missing or too short to search. */
export function readSearchTerm(params: Pick<URLSearchParams, 'get'>): string {
  const term = (params.get(SEARCH_PARAM) ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  return term.length >= MIN_SEARCH_LENGTH ? term : '';
}

/** A query string with `term` as the search, other parameters untouched. */
export function writeSearchTerm(params: URLSearchParams | string, term: string): string {
  const next = new URLSearchParams(params);
  const trimmed = term.trim();
  if (trimmed) {
    next.set(SEARCH_PARAM, trimmed);
  } else {
    next.delete(SEARCH_PARAM);
  }
  return next.toString();
}

/**
 * Text folded for matching the way the API does: case and accents do not
 * matter, so "doner" finds "Döner" and "cig kofte" finds "Çiğ Köfte".
 */
export function foldSearchText(text: string): string {
  return text
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether any of `texts` contains `term`, folded. */
export function matchesSearch(term: string, texts: Array<string | null | undefined>): boolean {
  const needle = foldSearchText(term);
  if (!needle) return false;
  return texts.some((text) => !!text && foldSearchText(text).includes(needle));
}
