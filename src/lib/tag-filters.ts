/** Query parameter holding the selected tag ids, comma-separated. */
export const TAG_FILTER_PARAM = 'tags';

/** The portal search accepts at most this many tag ids. */
export const MAX_TAG_FILTERS = 10;

/** Selected tag ids from the URL, de-duplicated, in the order they were picked. */
export function readTagFilter(params: Pick<URLSearchParams, 'get'>): string[] {
  const raw = params.get(TAG_FILTER_PARAM) ?? '';
  return [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
}

/** A query string with `tagIds` as the tag filter, other parameters untouched. */
export function writeTagFilter(params: URLSearchParams | string, tagIds: string[]): string {
  const next = new URLSearchParams(params);
  if (tagIds.length) {
    next.set(TAG_FILTER_PARAM, tagIds.join(','));
  } else {
    next.delete(TAG_FILTER_PARAM);
  }
  return next.toString();
}
