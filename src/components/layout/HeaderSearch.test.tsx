import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderSearch, SEARCH_DEBOUNCE_MS } from './HeaderSearch';

const nav = vi.hoisted(() => ({
  pathname: '/',
  params: new URLSearchParams(),
  router: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
  useRouter: () => nav.router,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const box = () => screen.getByRole('searchbox', { name: 'search.placeholder' });
const type = (value: string) => fireEvent.change(box(), { target: { value } });

describe('<HeaderSearch />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.pathname = '/';
    nav.params = new URLSearchParams('tags=t-vegan');
  });
  afterEach(() => vi.useRealTimers());

  it('searches 300 ms after typing stops, keeping the other filters in the URL', () => {
    render(<HeaderSearch />);

    type('dö');
    type('döner');
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(nav.router.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(nav.router.replace).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).toHaveBeenCalledWith('/?tags=t-vegan&q=d%C3%B6ner', { scroll: false });
  });

  it('waits for 2 characters', () => {
    render(<HeaderSearch />);

    type('d');
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it('starts from the term in the URL and removes it when cleared', () => {
    nav.params = new URLSearchParams('q=pizza');
    render(<HeaderSearch />);
    expect(box()).toHaveValue('pizza');

    fireEvent.click(screen.getByRole('button', { name: 'search.clear' }));

    expect(nav.router.replace).toHaveBeenCalledWith('/', { scroll: false });
  });

  it('searches at once on submit, and from another page opens the results', () => {
    nav.pathname = '/brand/branch';
    render(<HeaderSearch />);

    type('kebab');
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(nav.router.push).not.toHaveBeenCalled();
    fireEvent.submit(box());

    expect(nav.router.push).toHaveBeenCalledWith('/?q=kebab');
  });
});
