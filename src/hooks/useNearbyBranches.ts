'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiErrorCode } from '@/lib/api-errors';
import { portalService } from '@/services/portal.service';
import type { PaginationMeta } from '@/types/auth';
import type { Branch } from '@/types/branch';

const PAGE_SIZE = 20;

interface Options {
  /** Rounded coordinates; `null` lists restaurants around the default city. */
  location: { lat: number; lng: number } | null;
  /** The search term, already 2-50 characters, or ''. */
  q: string;
  tagIds: string[];
  /** False while it is not yet known which location to search (no request). */
  enabled: boolean;
  /**
   * The API rejected the query (`400 VALIDATION_FAILED`, e.g. a bad term or
   * more than ten tag ids). The caller drops the term and the tag filters,
   * which searches once more without them.
   */
  onInvalidQuery: () => void;
}

interface SearchState {
  /** The search these results belong to; results of another are stale. */
  key: string | null;
  branches: Branch[];
  meta: PaginationMeta | null;
}

/**
 * The portal's restaurant search, paginated with "Load more". A new location,
 * term or tag filter starts again from page 1.
 */
export function useNearbyBranches({ location, q, tagIds, enabled, onInvalidQuery }: Options) {
  const lat = location?.lat;
  const lng = location?.lng;
  const tagKey = tagIds.join(',');
  const key = enabled ? JSON.stringify([lat ?? null, lng ?? null, q, tagKey]) : null;

  const [state, setState] = useState<SearchState>({ key: null, branches: [], meta: null });
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);

  const latestKey = useRef(key);
  const onInvalidQueryRef = useRef(onInvalidQuery);
  useEffect(() => {
    latestKey.current = key;
    onInvalidQueryRef.current = onInvalidQuery;
  });

  const fetchPage = useCallback(
    (page: number) =>
      portalService.getNearbyBranches({
        ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
        q,
        tagIds: tagKey ? tagKey.split(',') : [],
        page,
        limit: PAGE_SIZE,
      }),
    [lat, lng, q, tagKey],
  );

  const handleError = useCallback(
    (error: unknown) => {
      if ((q || tagKey) && getApiErrorCode(error) === 'VALIDATION_FAILED') {
        onInvalidQueryRef.current();
      } else {
        console.error('Failed to fetch branches', error);
      }
    },
    [q, tagKey],
  );

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetchPage(1)
      .then((result) => {
        if (!cancelled) setState({ key, branches: result.data ?? [], meta: result.meta ?? null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ key, branches: [], meta: null });
        handleError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [key, fetchPage, handleError]);

  const current = state.key === key ? state : null;
  const meta = current?.meta ?? null;
  const hasMore = !!meta && meta.page < meta.totalPages;

  const loadMore = useCallback(async () => {
    if (!meta || !hasMore || loadingMoreKey === key) return;
    const searchKey = key;
    setLoadingMoreKey(searchKey);
    try {
      const result = await fetchPage(meta.page + 1);
      setState((previous) => {
        if (previous.key !== searchKey) return previous;
        const known = new Set(previous.branches.map((branch) => branch.id));
        return {
          key: searchKey,
          branches: [...previous.branches, ...result.data.filter((branch) => !known.has(branch.id))],
          meta: result.meta,
        };
      });
    } catch (error) {
      if (latestKey.current === searchKey) handleError(error);
    } finally {
      setLoadingMoreKey((previous) => (previous === searchKey ? null : previous));
    }
  }, [fetchPage, handleError, hasMore, key, loadingMoreKey, meta]);

  return {
    branches: current?.branches ?? [],
    meta,
    isLoading: key !== null && !current,
    isLoadingMore: key !== null && loadingMoreKey === key,
    hasMore,
    loadMore,
  };
}
