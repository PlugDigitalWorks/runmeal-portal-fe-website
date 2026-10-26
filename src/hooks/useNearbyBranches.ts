'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiErrorCode } from '@/lib/api-errors';
import { portalService } from '@/services/portal.service';
import type { PaginationMeta } from '@/types/auth';
import type { Branch } from '@/types/branch';

const PAGE_SIZE = 20;

interface Options {
  location: { lat: number; lng: number } | null;
  tagIds: string[];
  /**
   * The API rejected the tag filter (`400 VALIDATION_FAILED`, e.g. more than
   * ten ids or a non-id value). The caller drops it, which searches again
   * without tags.
   */
  onInvalidTags: () => void;
}

interface SearchState {
  /** The search these results belong to; results of another are stale. */
  key: string | null;
  branches: Branch[];
  meta: PaginationMeta | null;
}

/**
 * The portal's nearby-restaurant search, paginated with "Load more". A new
 * location or tag filter starts again from page 1.
 */
export function useNearbyBranches({ location, tagIds, onInvalidTags }: Options) {
  const lat = location?.lat;
  const lng = location?.lng;
  const tagKey = tagIds.join(',');
  const key = lat === undefined || lng === undefined ? null : `${lat},${lng}|${tagKey}`;

  const [state, setState] = useState<SearchState>({ key: null, branches: [], meta: null });
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);

  const latestKey = useRef(key);
  const onInvalidTagsRef = useRef(onInvalidTags);
  useEffect(() => {
    latestKey.current = key;
    onInvalidTagsRef.current = onInvalidTags;
  });

  const fetchPage = useCallback(
    (page: number) =>
      portalService.getNearbyBranches({
        lat: lat as number,
        lng: lng as number,
        tagIds: tagKey ? tagKey.split(',') : [],
        page,
        limit: PAGE_SIZE,
      }),
    [lat, lng, tagKey],
  );

  const handleError = useCallback(
    (error: unknown) => {
      if (tagKey && getApiErrorCode(error) === 'VALIDATION_FAILED') {
        onInvalidTagsRef.current();
      } else {
        console.error('Failed to fetch branches', error);
      }
    },
    [tagKey],
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
