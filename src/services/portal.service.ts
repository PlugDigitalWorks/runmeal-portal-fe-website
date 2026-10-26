import { api } from '@/lib/axios';
import type { ApiResponse, PaginationMeta } from '@/types/auth';
import type { Branch } from '@/types/branch';
import type { PortalTagGroups } from '@/types/tag';

export interface PortalNearbyQuery {
  lat: number;
  lng: number;
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

  /** Restaurants of every brand delivering to the point, nearest first. */
  async getNearbyBranches({ lat, lng, tagIds, page = 1, limit = 20 }: PortalNearbyQuery) {
    const response = await api.get<ApiResponse<{ data: Branch[]; meta: PaginationMeta }>>('/portal/branches/nearby', {
      params: {
        lat,
        lng,
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
