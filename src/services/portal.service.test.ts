import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/axios';
import { portalService, resetPortalTagsCache } from './portal.service';

vi.mock('@/lib/axios', () => ({
  api: { get: vi.fn() },
}));

const mockedApi = vi.mocked(api);

const page = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };

describe('portalService', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    resetPortalTagsCache();
  });

  it('sends every selected tag as one comma-separated tagIds (all must match)', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: true, data: page } });

    const result = await portalService.getNearbyBranches({
      lat: 41.04,
      lng: 28.99,
      tagIds: ['tag-burger', 'tag-vegan', 'tag-gluten-free'],
      page: 2,
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/portal/branches/nearby', {
      params: { lat: 41.04, lng: 28.99, tagIds: 'tag-burger,tag-vegan,tag-gluten-free', page: 2, limit: 20 },
    });
    expect(result).toEqual(page);
  });

  it('leaves tagIds out when no tag is selected', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: true, data: page } });

    await portalService.getNearbyBranches({ lat: 41, lng: 29, tagIds: [] });

    expect(mockedApi.get.mock.calls[0][1]).toEqual({ params: { lat: 41, lng: 29, page: 1, limit: 20 } });
  });

  it('fetches the tag list once per session', async () => {
    const groups = { cuisine: [], feature: [], product: [] };
    mockedApi.get.mockResolvedValue({ data: { status: true, data: groups } });

    await expect(portalService.getTags()).resolves.toBe(groups);
    await expect(portalService.getTags()).resolves.toBe(groups);

    expect(mockedApi.get).toHaveBeenCalledTimes(1);
    expect(mockedApi.get).toHaveBeenCalledWith('/portal/tags');
  });

  it('asks for the tag list again after a failure', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('offline'));
    mockedApi.get.mockResolvedValueOnce({ data: { status: true, data: { cuisine: [], feature: [], product: [] } } });

    await expect(portalService.getTags()).rejects.toThrow('offline');
    await expect(portalService.getTags()).resolves.toBeDefined();

    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });
});
