import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Branch } from '@/types/branch';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { ProductTag, Tag } from '@/types/tag';
import { BranchView } from './BranchView';

const stable = vi.hoisted(() => ({
  translation: {
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  },
  branchContext: { selectedBranch: null, setSelectedBranch: vi.fn() },
  cart: { addToCart: vi.fn() },
  searchParams: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
  userContext: { user: null as null | { id: string } },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => stable.searchParams,
  useRouter: () => stable.router,
}));
vi.mock('@/context/UserContext', () => ({ useUser: () => stable.userContext }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/context/BranchContext', () => ({ useBranch: () => stable.branchContext }));
vi.mock('@/context/CartContext', () => ({ useCart: () => stable.cart }));
vi.mock('@/components/branches/BranchStickyCart', () => ({ BranchStickyCart: () => null }));

const tag = (id: string, en: string, tr: string, extra: Partial<ProductTag> = {}): ProductTag => ({
  id,
  kind: 'product',
  group: null,
  slug: id,
  name: { tr, en },
  icon: null,
  sortOrder: 0,
  source: 'product',
  ...extra,
});

const vegan = tag('vegan', 'Vegan', 'Vegan', { icon: 'leaf', sortOrder: 1 });
const spicy = tag('spicy', 'Spicy', 'Acılı', { icon: 'flame', sortOrder: 2 });
const glutenFree = tag('gluten-free', 'Gluten-free', 'Glutensiz', { icon: 'some-future-icon', sortOrder: 3 });

const product = (id: string, categoryId: string, tags: ProductTag[] = []): Product => ({
  id,
  categoryId,
  branchId: 'branch-1',
  name: `Product ${id}`,
  description: `About ${id}`,
  price: 10,
  isActive: true,
  tags,
});

const categories: Category[] = [
  { id: 'burgers', name: 'Burgers' },
  { id: 'salads', name: 'Salads', tags: [vegan] },
  { id: 'drinks', name: 'Drinks' },
];

const products = [
  product('beef', 'burgers', [spicy]),
  product('garden', 'burgers', [vegan, spicy, glutenFree, tag('nut-free', 'Nut-free', 'Fındıksız', { sortOrder: 4 })]),
  product('caesar', 'salads', [{ ...vegan, source: 'category' }]),
  product('cola', 'drinks'),
];

const restaurantTags: Tag[] = [
  { ...tag('terrace', 'Terrace', 'Teras'), kind: 'restaurant', group: 'feature' },
  { ...tag('burger', 'Burger', 'Burger'), kind: 'restaurant', group: 'cuisine' },
];

const branch = { id: '7b1e2c3d-4a5b-4c6d-8e7f-901234567890', name: 'Premium Burger Co', addressText: 'Street 1' } as Branch;

const renderMenu = () =>
  render(<BranchView branch={branch} categories={categories} products={products} tags={restaurantTags} />);

const section = (name: string) => screen.getByRole('region', { name });
const badgeTexts = (container: HTMLElement) =>
  within(container).queryAllByTestId('tag-badge').map((el) => el.textContent);

describe('<BranchView /> menu tags', () => {
  beforeEach(() => {
    stable.translation.i18n.resolvedLanguage = 'en';
    stable.searchParams = new URLSearchParams();
    stable.userContext.user = null;
  });

  it('shows product tags, own and inherited, as badges on the cards', () => {
    renderMenu();

    const caesar = screen.getByText('Product caesar').closest('div.group') as HTMLElement;
    expect(badgeTexts(caesar)).toEqual(['Vegan']);

    const garden = screen.getByText('Product garden').closest('div.group') as HTMLElement;
    expect(badgeTexts(garden)).toEqual(['Vegan', 'Spicy', 'Gluten-free']);
    expect(within(garden).getByText('+1')).toBeInTheDocument();
  });

  it('draws an icon for known icon keys only', () => {
    renderMenu();

    const garden = screen.getByText('Product garden').closest('div.group') as HTMLElement;
    const [veganBadge, , glutenFreeBadge] = within(garden).getAllByTestId('tag-badge');
    expect(veganBadge.querySelector('svg')).not.toBeNull();
    expect(glutenFreeBadge.querySelector('svg')).toBeNull();
  });

  it('names tags in the interface language', () => {
    stable.translation.i18n.resolvedLanguage = 'tr';

    renderMenu();

    const beef = screen.getByText('Product beef').closest('div.group') as HTMLElement;
    expect(badgeTexts(beef)).toEqual(['Acılı']);
  });

  it('shows the restaurant tags (cuisine first) and each category its tags', () => {
    renderMenu();

    expect(badgeTexts(screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement)).toEqual([
      'Burger',
      'Terrace',
    ]);
    const salads = section('Salads');
    expect(badgeTexts(within(salads).getByRole('heading', { name: 'Salads' }).parentElement as HTMLElement)).toEqual([
      'Vegan',
    ]);
  });

  it('offers quick filters for the tags on the menu, and hides categories left empty', () => {
    renderMenu();

    const quickFilters = screen.getByRole('group', { name: 'menu.quickFilters' });
    expect(within(quickFilters).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Vegan',
      'Spicy',
      'Gluten-free',
      'Nut-free',
    ]);

    fireEvent.click(within(quickFilters).getByRole('button', { name: 'Vegan' }));

    expect(within(section('Burgers')).queryByText('Product beef')).not.toBeInTheDocument();
    expect(within(section('Burgers')).getByText('Product garden')).toBeInTheDocument();
    expect(within(section('Salads')).getByText('Product caesar')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Drinks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drinks' })).not.toBeInTheDocument();

    fireEvent.click(within(quickFilters).getByRole('button', { name: 'Vegan', pressed: true }));

    expect(section('Drinks')).toBeInTheDocument();
    expect(screen.getByText('Product beef')).toBeInTheDocument();
  });

  it('shows the tags in the product detail', () => {
    renderMenu();

    const garden = screen.getByText('Product garden').closest('div.group') as HTMLElement;
    fireEvent.click(within(garden).getByRole('button'));

    const detail = screen.getByRole('heading', { level: 2, name: 'Product garden' }).parentElement as HTMLElement;
    expect(badgeTexts(detail)).toEqual(['Vegan', 'Spicy', 'Gluten-free', 'Nut-free']);
  });
});

describe('<BranchView /> menu search', () => {
  beforeEach(() => {
    stable.translation.i18n.resolvedLanguage = 'en';
    stable.userContext.user = null;
  });

  it('opens with the portal search term and shows the matching dishes first', () => {
    stable.searchParams = new URLSearchParams('q=GARDEN');

    renderMenu();

    expect(screen.getByRole('searchbox', { name: 'menu.searchPlaceholder' })).toHaveValue('GARDEN');
    const matches = screen.getByRole('region', { name: 'menu.searchMatches' });
    expect(within(matches).getByText('Product garden')).toBeInTheDocument();
    expect(within(matches).queryByText('Product beef')).not.toBeInTheDocument();
    // The whole menu still follows.
    expect(within(section('Burgers')).getByText('Product beef')).toBeInTheDocument();
  });

  it('matches category and tag names, ignoring case and accents', () => {
    stable.searchParams = new URLSearchParams('q=acili');
    stable.translation.i18n.resolvedLanguage = 'tr';

    renderMenu();

    const matches = screen.getByRole('region', { name: 'menu.searchMatches' });
    expect(within(matches).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Product beef',
      'Product garden',
    ]);
  });

  it('shows the whole menu when nothing matches, and clears back to it', () => {
    stable.searchParams = new URLSearchParams('q=sushi');

    renderMenu();

    expect(screen.queryByRole('region', { name: 'menu.searchMatches' })).not.toBeInTheDocument();
    expect(screen.getByText('Product cola')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'menu.clearSearch' }));
    expect(screen.getByRole('searchbox', { name: 'menu.searchPlaceholder' })).toHaveValue('');
  });
});

describe('<BranchView /> signed out', () => {
  it('asks to sign in on adding to the basket, keeps the item and comes back here', async () => {
    stable.userContext.user = null;
    window.history.replaceState(null, '', '/brand/branch?q=garden');

    renderMenu();
    const garden = screen.getAllByText('Product garden')[0].closest('div.group') as HTMLElement;
    fireEvent.click(within(garden).getByRole('button'));
    fireEvent.click(await screen.findByRole('button', { name: 'product.addToCart' }));

    await waitFor(() => expect(stable.router.push).toHaveBeenCalledWith('/login'));
    expect(stable.cart.addToCart).toHaveBeenCalled();
    expect(sessionStorage.getItem('runmeal_return_path')).toBe('/brand/branch?q=garden');
  });

  it('adds straight to the basket when signed in', async () => {
    stable.userContext.user = { id: 'u-1' };
    stable.searchParams = new URLSearchParams();

    renderMenu();
    const beef = screen.getByText('Product beef').closest('div.group') as HTMLElement;
    fireEvent.click(within(beef).getByRole('button'));
    fireEvent.click(await screen.findByRole('button', { name: 'product.addToCart' }));

    await waitFor(() => expect(stable.cart.addToCart).toHaveBeenCalled());
    expect(stable.router.push).not.toHaveBeenCalled();
  });
});

describe('<BranchView /> sign-up branch', () => {
  it('marks this restaurant as where a sign-up starts', () => {
    sessionStorage.clear();

    renderMenu();

    expect(sessionStorage.getItem('runmeal_signup_branch_id')).toBe(branch.id);
  });
});
