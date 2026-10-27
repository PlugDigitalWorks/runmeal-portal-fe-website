import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { portalService } from '@/services/portal.service';
import type { Branch } from '@/types/branch';
import type { PortalTagGroups, Tag } from '@/types/tag';
import { LocationProvider } from '@/context/LocationContext';
import { browserLocationStore } from '@/lib/browser-location-store';
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
    tempAddress: { location: { latitude: 41.04, longitude: 28.99 }, formattedAddress: 'Kadıköy' } as
      | { location: { latitude: number; longitude: number }; formattedAddress: string }
      | null,
  },
}));

const KADIKOY = { location: { latitude: 41.04, longitude: 28.99 }, formattedAddress: 'Kadıköy' };

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

const renderHome = () =>
  render(
    <LocationProvider>
      <HomeView />
    </LocationProvider>,
  );

beforeEach(() => {
  nav.set('');
  nav.router.replace.mockImplementation((url: string) => nav.set(url.split('?')[1] ?? ''));
  stable.user.tempAddress = KADIKOY;
  stable.translation.i18n.resolvedLanguage = 'en';
  browserLocationStore.reset();
  mockedPortal.getTags.mockResolvedValue(tagGroups);
  mockedPortal.getNearbyBranches.mockResolvedValue(page([branch('a')]));
});

describe('<HomeView /> tag filters', () => {
  it('sends the tags selected in the URL as one filter every restaurant must match', async () => {
    nav.set('tags=t-burger,t-vegan');

    renderHome();

    await waitFor(() => expect(mockedPortal.getNearbyBranches).toHaveBeenCalled());
    expect(lastSearch()).toEqual({ lat: 41.04, lng: 28.99, q: '', tagIds: ['t-burger', 't-vegan'], page: 1, limit: 20 });
  });

  it('keeps the selection in the URL and restores it as removable chips', async () => {
    renderHome();

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

    renderHome();

    expect(await screen.findByText('home.noMatches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'home.clearAllFilters' }));

    expect(nav.router.replace).toHaveBeenLastCalledWith('/', { scroll: false });
  });

  it('loads the next page, and goes back to page 1 when the filters change', async () => {
    mockedPortal.getNearbyBranches
      .mockResolvedValueOnce(page([branch('a')], 1, 2))
      .mockResolvedValueOnce(page([branch('b')], 2, 2))
      .mockResolvedValue(page([branch('c')], 1, 1));

    renderHome();

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

    renderHome();

    expect(await screen.findByText('Restaurant a')).toBeInTheDocument();
    expect(nav.router.replace).toHaveBeenCalledWith('/', { scroll: false });
    expect(mockedPortal.getNearbyBranches).toHaveBeenCalledTimes(2);
    expect(mockedPortal.getNearbyBranches.mock.calls[1][0].tagIds).toEqual([]);
  });

  it('shows distance, up to three restaurant tags (cuisine first) and the selected dish tags', async () => {
    nav.set('tags=t-vegan');
    mockedPortal.getNearbyBranches.mockResolvedValue(page([branch('a', [terrace, kids, burger, pizza])]));

    renderHome();

    const card = (await screen.findByText('Restaurant a')).closest('a') as HTMLElement;
    expect(within(card).getAllByTestId('tag-badge').map((el) => el.textContent)).toEqual([
      'Pizza',
      'Burger',
      'Terrace',
    ]);
    expect(within(card).getByText('home.hasDishes {"tags":"vegan"}')).toBeInTheDocument();
    expect(within(card).getByText('1.5 km')).toBeInTheDocument();
  });

  it('renders tag names as text, never as HTML', async () => {
    const sneaky = tag('t-x', 'restaurant', 'cuisine', '<img src=x onerror=alert(1)>');
    mockedPortal.getTags.mockResolvedValue({ cuisine: [sneaky], feature: [], product: [] });

    await act(async () => {
      renderHome();
    });

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});

describe('<HomeView /> location', () => {
  const geolocation = { getCurrentPosition: vi.fn() };

  beforeEach(() => {
    stable.user.tempAddress = null;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
  });

  it('loads restaurants around the default city at once, without coordinates', async () => {
    renderHome();

    expect(await screen.findByText('Restaurant a')).toBeInTheDocument();
    expect(lastSearch()).not.toHaveProperty('lat');
    expect(lastSearch()).not.toHaveProperty('lng');
    // Asked once, with the reason; the list does not wait for the answer.
    expect(screen.getByText('location.prompt')).toBeInTheDocument();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('shows the default-city banner after a decline, with the address picker', async () => {
    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'location.notNow' }));

    expect(screen.getByText('location.defaultCityBanner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'location.chooseAddress' })).toBeInTheDocument();
    expect(screen.queryByText('location.prompt')).not.toBeInTheDocument();
    expect(lastSearch()).not.toHaveProperty('lat');
  });

  it('treats a browser refusal as a decline and never asks again this session', async () => {
    geolocation.getCurrentPosition.mockImplementation((_ok, fail) => fail({ code: 1 }));
    const first = renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'location.share' }));

    expect(await screen.findByText('location.defaultCityBanner')).toBeInTheDocument();
    first.unmount();

    renderHome();
    expect(await screen.findByText('location.defaultCityBanner')).toBeInTheDocument();
    expect(screen.queryByText('location.prompt')).not.toBeInTheDocument();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('sends a granted location rounded to 3 decimals and hides the banner', async () => {
    geolocation.getCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 41.0479769, longitude: 28.9966068 } }),
    );
    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'location.share' }));

    await waitFor(() => expect(lastSearch()).toMatchObject({ lat: 41.048, lng: 28.997, page: 1 }));
    expect(screen.queryByText('location.defaultCityBanner')).not.toBeInTheDocument();
    expect(screen.queryByText('location.prompt')).not.toBeInTheDocument();
  });

  it('sends a chosen address rounded too', async () => {
    stable.user.tempAddress = { location: { latitude: 51.4613456, longitude: -0.3037891 }, formattedAddress: 'Richmond' };

    renderHome();

    await waitFor(() => expect(lastSearch()).toMatchObject({ lat: 51.461, lng: -0.304 }));
    expect(screen.queryByText('location.prompt')).not.toBeInTheDocument();
  });

  it('shows distance only when the visitor gave a location, formatted per language', async () => {
    mockedPortal.getNearbyBranches.mockResolvedValue(page([branch('a')]));
    browserLocationStore.decline();
    const withoutLocation = renderHome();
    const card = (await screen.findByText('Restaurant a')).closest('a') as HTMLElement;
    expect(within(card).queryByText(/km|m$/)).not.toBeInTheDocument();
    withoutLocation.unmount();

    stable.user.tempAddress = KADIKOY;
    stable.translation.i18n.resolvedLanguage = 'tr';
    renderHome();
    const located = (await screen.findByText('Restaurant a')).closest('a') as HTMLElement;
    expect(within(located).getByText('1,5 km')).toBeInTheDocument();
  });
});

describe('<HomeView /> search', () => {
  it('searches with the term from the URL and shows the result count', async () => {
    nav.set('q=d%C3%B6ner&tags=t-burger');
    mockedPortal.getNearbyBranches.mockResolvedValue({
      data: [branch('a')],
      meta: { total: 42, page: 1, limit: 20, totalPages: 3 },
    });

    renderHome();

    await waitFor(() => expect(lastSearch()).toMatchObject({ q: 'döner', tagIds: ['t-burger'], page: 1 }));
    expect(await screen.findByText('home.resultsCount {"count":42}')).toBeInTheDocument();
  });

  it('opens a restaurant with the search term', async () => {
    nav.set('q=cig kofte');

    renderHome();

    const card = (await screen.findByText('Restaurant a')).closest('a') as HTMLElement;
    expect(card).toHaveAttribute('href', '/brand/a?q=cig+kofte');
  });

  it('goes back to page 1 when the term changes', async () => {
    mockedPortal.getNearbyBranches
      .mockResolvedValueOnce(page([branch('a')], 1, 2))
      .mockResolvedValueOnce(page([branch('b')], 2, 2))
      .mockResolvedValue(page([branch('c')], 1, 1));
    renderHome();

    fireEvent.click(await screen.findByRole('button', { name: 'home.loadMore' }));
    expect(await screen.findByText('Restaurant b')).toBeInTheDocument();

    act(() => nav.set('q=pizza'));

    await waitFor(() => expect(lastSearch()).toMatchObject({ q: 'pizza', page: 1 }));
    expect(await screen.findByText('Restaurant c')).toBeInTheDocument();
  });

  it('names the term when nothing is found and clears the search and filters', async () => {
    nav.set('q=sushi&tags=t-vegan&utm=mail');
    mockedPortal.getNearbyBranches.mockResolvedValue(page([]));

    renderHome();

    expect(await screen.findByText('home.noResultsForTerm {"term":"sushi"}')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'home.clearSearchAndFilters' }));
    expect(nav.router.replace).toHaveBeenLastCalledWith('/?utm=mail', { scroll: false });
  });

  it('drops the term and filters and searches once more without them on VALIDATION_FAILED', async () => {
    nav.set('q=ab&tags=t-vegan');
    mockedPortal.getNearbyBranches
      .mockRejectedValueOnce({ response: { status: 400, data: { code: 'VALIDATION_FAILED' } } })
      .mockResolvedValue(page([branch('a')]));

    renderHome();

    expect(await screen.findByText('Restaurant a')).toBeInTheDocument();
    expect(mockedPortal.getNearbyBranches).toHaveBeenCalledTimes(2);
    expect(mockedPortal.getNearbyBranches.mock.calls[1][0]).toMatchObject({ q: '', tagIds: [] });
  });

  it('works signed out: no redirect, the list loads', async () => {
    stable.user.tempAddress = null;

    renderHome();

    expect(await screen.findByText('Restaurant a')).toBeInTheDocument();
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe('<HomeView /> sign-up branch', () => {
  it('forgets the restaurant a sign-up would record once the visitor is back on the list', async () => {
    sessionStorage.setItem('runmeal_signup_branch_id', '5a6c5004-acad-4444-888e-61a6f9f8016b');

    renderHome();

    await screen.findByText('Restaurant a');
    expect(sessionStorage.getItem('runmeal_signup_branch_id')).toBeNull();
  });
});

describe('<HomeView /> featured restaurants', () => {
  it('badges featured restaurants and keeps the order the API sent', async () => {
    mockedPortal.getNearbyBranches.mockResolvedValue(
      page([{ ...branch('promoted'), isFeatured: true }, { ...branch('plain'), isFeatured: false }, branch('older')]),
    );

    renderHome();

    const promoted = (await screen.findByText('Restaurant promoted')).closest('a') as HTMLElement;
    expect(within(promoted).getByText('home.featured')).toBeInTheDocument();
    for (const name of ['Restaurant plain', 'Restaurant older']) {
      expect(within(screen.getByText(name).closest('a') as HTMLElement).queryByText('home.featured')).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Restaurant promoted',
      'Restaurant plain',
      'Restaurant older',
    ]);
  });
});
