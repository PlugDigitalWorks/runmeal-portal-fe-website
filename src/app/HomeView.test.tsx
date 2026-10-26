import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { portalService } from '@/services/portal.service';
import type { Branch } from '@/types/branch';
import type { PortalTagGroups, Tag } from '@/types/tag';
import { HomeView } from './HomeView';

/** A query string the mocked router writes and `useSearchParams` reads back. */
const nav = vi.hoisted(() => {
  let params = new URLSearchParams();
  const listeners = new Set<() => void>();
  return {
    get: () => params,
    set(query: string) {
      params = new URLSearchParams(query);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    router: { replace: vi.fn(), push: vi.fn() },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useRouter: () => nav.router,
    usePathname: () => '/',
    useSearchParams: () => useSyncExternalStore(nav.subscribe, nav.get),
  };
});

const stable = vi.hoisted(() => ({
  translation: {
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
    i18n: { resolvedLanguage: 'en' },
  },
  user: {
    user: null,
    addresses: [],
    isLoading: false,
    tempAddress: { location: { latitude: 41.04, longitude: 28.99 }, formattedAddress: 'Kadıköy' },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/context/UserContext', () => ({ useUser: () => stable.user }));
vi.mock('@/services/portal.service', () => ({
  portalService: { getTags: vi.fn(), getNearbyBranches: vi.fn() },
}));

const mockedPortal = vi.mocked(portalService);

const tag = (id: string, kind: Tag['kind'], group: Tag['group'], en: string, sortOrder = 0): Tag => ({
  id,
  kind,
  group,
  slug: id,
  name: { tr: `${en} (tr)`, en },
  icon: null,
  sortOrder,
});

const burger = tag('t-burger', 'restaurant', 'cuisine', 'Burger', 1);
const pizza = tag('t-pizza', 'restaurant', 'cuisine', 'Pizza', 0);
const terrace = tag('t-terrace', 'restaurant', 'feature', 'Terrace', 0);
const kids = tag('t-kids', 'restaurant', 'feature', 'Kid friendly', 1);
const vegan = tag('t-vegan', 'product', null, 'Vegan');
const glutenFree = tag('t-gluten-free', 'product', null, 'Gluten-free');

const tagGroups: PortalTagGroups = { cuisine: [pizza, burger], feature: [terrace, kids], product: [vegan, glutenFree] };

const branch = (id: string, tags: Tag[] = []) =>
  ({ id, name: `Restaurant ${id}`, slug: id, brandSlug: 'brand', addressText: 'Street 1', distanceM: 1500, tags }) as Branch;

const page = (items: Branch[], current = 1, totalPages = 1) => ({
  data: items,
  meta: { total: items.length, page: current, limit: 20, totalPages },
});

const lastSearch = () => mockedPortal.getNearbyBranches.mock.calls.at(-1)?.[0];

describe('<HomeView /> tag filters', () => {
  beforeEach(() => {
    nav.set('');
    nav.router.replace.mockImplementation((url: string) => nav.set(url.split('?')[1] ?? ''));
    mockedPortal.getTags.mockResolvedValue(tagGroups);
    mockedPortal.getNearbyBranches.mockResolvedValue(page([branch('a')]));
  });

  it('sends the tags selected in the URL as one filter every restaurant must match', async () => {
    nav.set('tags=t-burger,t-vegan');

    render(<HomeView />);

    await waitFor(() => expect(mockedPortal.getNearbyBranches).toHaveBeenCalled());
    expect(lastSearch()).toEqual({ lat: 41.04, lng: 28.99, tagIds: ['t-burger', 't-vegan'], page: 1, limit: 20 });
  });

  it('keeps the selection in the URL and restores it as removable chips', async () => {
    render(<HomeView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Burger', pressed: false }));

    expect(nav.router.replace).toHaveBeenLastCalledWith('/?tags=t-burger', { scroll: false });
    const chips = await screen.findByRole('list', { name: 'home.selectedFilters' });
    expect(within(chips).getByText('Burger')).toBeInTheDocument();
    await waitFor(() => expect(lastSearch()?.tagIds).toEqual(['t-burger']));

    fireEvent.click(within(chips).getByRole('button', { name: 'home.removeFilter {"name":"Burger"}' }));

    expect(nav.router.replace).toHaveBeenLastCalledWith('/', { scroll: false });
    await waitFor(() => expect(lastSearch()?.tagIds).toEqual([]));
  });

  it('says no restaurant matches and offers to clear the filters', async () => {
    nav.set('tags=t-vegan,t-gluten-free');
    mockedPortal.getNearbyBranches.mockResolvedValue(page([]));

    render(<HomeView />);

    expect(await screen.findByText('home.noMatches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'home.clearAllFilters' }));

    expect(nav.router.replace).toHaveBeenLastCalledWith('/', { scroll: false });
  });

  it('loads the next page, and goes back to page 1 when the filters change', async () => {
    mockedPortal.getNearbyBranches
      .mockResolvedValueOnce(page([branch('a')], 1, 2))
      .mockResolvedValueOnce(page([branch('b')], 2, 2))
      .mockResolvedValue(page([branch('c')], 1, 1));

    render(<HomeView />);

    fireEvent.click(await screen.findByRole('button', { name: 'home.loadMore' }));
    expect(await screen.findByText('Restaurant b')).toBeInTheDocument();
    expect(screen.getByText('Restaurant a')).toBeInTheDocument();
    expect(lastSearch()?.page).toBe(2);
    expect(screen.queryByRole('button', { name: 'home.loadMore' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pizza', pressed: false }));

    await waitFor(() => expect(lastSearch()).toMatchObject({ tagIds: ['t-pizza'], page: 1 }));
    expect(await screen.findByText('Restaurant c')).toBeInTheDocument();
    expect(screen.queryByText('Restaurant a')).not.toBeInTheDocument();
  });

  it('drops the tag filters and searches once more without them on VALIDATION_FAILED', async () => {
    nav.set('tags=not-an-id');
    mockedPortal.getNearbyBranches
      .mockRejectedValueOnce({ response: { status: 400, data: { status: false, code: 'VALIDATION_FAILED' } } })
      .mockResolvedValue(page([branch('a')]));

    render(<HomeView />);

    expect(await screen.findByText('Restaurant a')).toBeInTheDocument();
    expect(nav.router.replace).toHaveBeenCalledWith('/', { scroll: false });
    expect(mockedPortal.getNearbyBranches).toHaveBeenCalledTimes(2);
    expect(mockedPortal.getNearbyBranches.mock.calls[1][0].tagIds).toEqual([]);
  });

  it('shows distance, up to three restaurant tags (cuisine first) and the selected dish tags', async () => {
    nav.set('tags=t-vegan');
    mockedPortal.getNearbyBranches.mockResolvedValue(page([branch('a', [terrace, kids, burger, pizza])]));

    render(<HomeView />);

    const card = (await screen.findByText('Restaurant a')).closest('a') as HTMLElement;
    expect(within(card).getAllByTestId('tag-badge').map((el) => el.textContent)).toEqual([
      'Pizza',
      'Burger',
      'Terrace',
    ]);
    expect(within(card).getByText('home.hasDishes {"tags":"vegan"}')).toBeInTheDocument();
    expect(within(card).getByText('home.kmAway {"distance":"1.5"}')).toBeInTheDocument();
  });

  it('renders tag names as text, never as HTML', async () => {
    const sneaky = tag('t-x', 'restaurant', 'cuisine', '<img src=x onerror=alert(1)>');
    mockedPortal.getTags.mockResolvedValue({ cuisine: [sneaky], feature: [], product: [] });

    await act(async () => {
      render(<HomeView />);
    });

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
