import { api } from '@/lib/axios';
import type { ApiResponse, PaginationMeta } from '@/types/auth';
import type { Branch } from '@/types/branch';
import type { PortalTagGroups } from '@/types/tag';

export interface PortalNearbyQuery {
  /** Together or not at all; without them the API lists the default city. */
  lat?: number;
  lng?: number;
  /** Restaurant, brand, tag, dish or category name; 2-50 characters. */
  q?: string;
  /** Every one must match; sent comma-separated, at most 10. */
  tagIds?: string[];
  page?: number;
  limit?: number;
}

/**
 * The filter list changes rarely (`max-age=300` plus an ETag), so one request
 * serves the whole session; the browser revalidates it on its own.
 */
let tagsRequest: Promise<PortalTagGroups> | null = null;

export const portalService = {
  getTags(): Promise<PortalTagGroups> {
    tagsRequest ??= api
      .get<ApiResponse<PortalTagGroups>>('/portal/tags')
      .then((response) => response.data.data)
      .catch((error) => {
        tagsRequest = null;
        throw error;
      });
    return tagsRequest;
  },

  /**
   * Restaurants of every brand delivering to the point, nearest first; without
   * a point, those around the default city with no delivery check.
   */
  async getNearbyBranches({ lat, lng, q, tagIds, page = 1, limit = 20 }: PortalNearbyQuery) {
    const response = await api.get<ApiResponse<{ data: Branch[]; meta: PaginationMeta }>>('/portal/branches/nearby', {
      params: {
        ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
        ...(q ? { q } : {}),
        ...(tagIds?.length ? { tagIds: tagIds.join(',') } : {}),
        page,
        limit,
      },
    });
    return response.data.data;
  },
};

/** Test hook: forget the session's tag list. */
export const resetPortalTagsCache = () => {
  tagsRequest = null;
};
