'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getApiErrorCode, getApiErrorStatus } from '@/lib/loyalty-errors';
import { STAMP_QR_INVALID_CODE } from '@/lib/loyalty-stamps';
import { loyaltyStampService, StampTransactionQuery } from '@/services/loyalty-stamp.service';
import { orderService } from '@/services/order.service';
import { CustomerStampTransaction, StampCard, StampQrResponse } from '@/types/loyalty-stamp';

/**
 * Data access for the stamp wallet.
 *
 * Two rules shape everything here: the backend is the only source of stamp
 * counts (profile reads also run lazy expiration, so a full card may reset on
 * a refresh), and a failed refresh keeps the last good payload on screen with
 * a retry rather than blanking the wallet.
 *
 * Unlike the single-brand storefront, the portal customer buys from many
 * brands, so every stamp read is per brand and the brand list has to be
 * discovered first — see `useStampBrands`.
 */

/** A 401 that survived the refresh interceptor means the session is really gone. */
const useSignOutOn401 = () => {
  const router = useRouter();

  return useCallback(
    (error: unknown) => {
      if (getApiErrorStatus(error) !== 401) return false;
      router.replace('/login');
      return true;
    },
    [router],
  );
};

export interface StampBrand {
  brandId: string;
  /** A branch name of that brand — the closest thing to a brand name we are given. */
  label: string;
  logoUrl: string | null;
}

export interface StampBrandsState {
  brands: StampBrand[];
  isLoading: boolean;
}

/**
 * The brands this customer could hold stamps with.
 *
 * There is no customer-facing brand list endpoint, and stamp reads are brand
 * scoped — so the set is derived from order history, which is exactly where a
 * stamp relationship comes from. A brand the customer has never ordered from
 * has no card to show anyway.
 */
export function useStampBrands(enabled: boolean): StampBrandsState {
  const [brands, setBrands] = useState<StampBrand[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const orders = await orderService.getMyOrders();
        if (cancelled) return;

        const byBrand = new Map<string, StampBrand>();
        for (const order of orders) {
          if (!order.brandId || byBrand.has(order.brandId)) continue;
          byBrand.set(order.brandId, {
            brandId: order.brandId,
            label: order.branchName?.trim() || '',
            logoUrl: order.branchLogoUrl ?? null,
          });
        }
        setBrands(Array.from(byBrand.values()));
      } catch (error) {
        // No brands means no wallet — never a blocking error.
        console.error('Failed to resolve the customer brand list', error);
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Signed out means "no brands" without having to clear the state we hold.
  return { brands: enabled ? brands : [], isLoading };
}

export interface StampQrState {
  qr: StampQrResponse | null;
  isLoading: boolean;
  hasError: boolean;
  refresh: () => void;
}

/**
 * The member QR is static and account-wide — one code for every brand — so it
 * is fetched once per signed-in session, re-requested after sign-in or account
 * changes (`userId` changes) and again whenever the backend rejects the value.
 */
export function useStampQr(userId: string | null | undefined): StampQrState {
  const [qr, setQr] = useState<StampQrResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const handle401 = useSignOutOn401();

  useEffect(() => {
    if (!userId) {
      setQr(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        let response: StampQrResponse;
        try {
          response = await loyaltyStampService.getQr();
        } catch (error) {
          // The signed value went stale; one fresh read is the documented fix.
          if (getApiErrorCode(error) !== STAMP_QR_INVALID_CODE) throw error;
          response = await loyaltyStampService.getQr();
        }
        if (cancelled) return;
        setQr(response);
      } catch (error) {
        if (cancelled) return;
        if (!handle401(error)) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken, handle401]);

  return {
    qr,
    isLoading,
    hasError,
    refresh: useCallback(() => setReloadToken((token) => token + 1), []),
  };
}

export interface StampBrandCards extends StampBrand {
  cards: StampCard[];
}

export interface StampCardsState {
  /** Null until the first read settles; `[]` means "checked, nothing to show". */
  groups: StampBrandCards[] | null;
  isLoading: boolean;
  /** True only when a refresh failed; `groups` still holds the last good read. */
  hasError: boolean;
  refresh: () => void;
}

/**
 * Stamp cards for every brand the customer has bought from, grouped by brand.
 *
 * Availability is checked before the cards: a brand that does not run the stamp
 * program must never advertise one, and anything short of an explicit `true`
 * keeps it out of the wallet. One brand failing never takes the others down.
 */
export function useStampCards(brands: StampBrand[], enabled: boolean): StampCardsState {
  const [groups, setGroups] = useState<StampBrandCards[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const handle401 = useSignOutOn401();

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  // `brands` is a fresh array every render; key the effect on its identity.
  const brandKey = brands.map((brand) => brand.brandId).join(',');

  useEffect(() => {
    if (!enabled) return;
    if (!brandKey) {
      setGroups([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setHasError(false);
      let sawError = false;

      const results = await Promise.all(
        brands.map(async (brand) => {
          try {
            const availability = await loyaltyStampService.getAvailability(brand.brandId);
            if (!availability?.isStampActive) return null;

            const cards = await loyaltyStampService.getCards(brand.brandId);
            return cards.length > 0 ? { ...brand, cards } : null;
          } catch (error) {
            if (handle401(error)) return null;
            // One brand failing must not blank the whole wallet.
            console.error(`Failed to read stamp cards for brand ${brand.brandId}`, error);
            sawError = true;
            return null;
          }
        }),
      );

      if (cancelled) return;
      setGroups(results.filter((group): group is StampBrandCards => group !== null));
      setHasError(sawError);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, brandKey, reloadToken, handle401]);

  // A card completed at the counter only shows up on the next read, so refresh
  // whenever the customer comes back to the tab with this screen open.
  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, refresh]);

  return { groups, isLoading, hasError, refresh };
}

/** Every card across every brand, for counts and "closest to a reward" ordering. */
export const flattenStampCards = (groups: StampBrandCards[] | null): StampCard[] =>
  (groups ?? []).flatMap((group) => group.cards);

export interface StampTransactionsState {
  transactions: CustomerStampTransaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  hasMore: boolean;
  total: number;
  loadMore: () => void;
  refresh: () => void;
}

const PAGE_SIZE = 20;

/** Stamp activity is its own screen — it is never merged into order history. */
export function useStampTransactions(
  brandId: string | null,
  filters: StampTransactionQuery = {},
): StampTransactionsState {
  const [transactions, setTransactions] = useState<CustomerStampTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const handle401 = useSignOutOn401();

  // Filters arrive as a fresh object every render; key the effect on the values.
  const filterKey = JSON.stringify(filters);
  const [appliedScope, setAppliedScope] = useState(`${brandId}|${filterKey}`);
  const scope = `${brandId}|${filterKey}`;

  // A brand or filter change restarts the list from the first page. Done during
  // render rather than in an effect so no request is fired for the stale page.
  if (appliedScope !== scope) {
    setAppliedScope(scope);
    setPage(1);
    setTransactions([]);
  }

  useEffect(() => {
    if (!brandId) return;

    let cancelled = false;
    const isFirstPage = page === 1;

    (async () => {
      if (isFirstPage) setIsLoading(true);
      else setIsLoadingMore(true);
      setHasError(false);

      try {
        const result = await loyaltyStampService.getTransactions(brandId, {
          ...(JSON.parse(filterKey) as StampTransactionQuery),
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setTransactions((current) => (isFirstPage ? result.items : [...current, ...result.items]));
        setTotalPages(result.meta?.totalPages ?? 1);
        setTotal(result.meta?.total ?? result.items.length);
      } catch (error) {
        if (cancelled) return;
        if (!handle401(error)) setHasError(true);
      } finally {
        if (cancelled) return;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, page, filterKey, reloadToken, handle401]);

  return {
    // Without a brand there is nothing to list; the held page stays for when
    // one is picked again.
    transactions: brandId ? transactions : [],
    isLoading,
    isLoadingMore,
    hasError,
    hasMore: page < totalPages,
    total,
    loadMore: useCallback(() => setPage((current) => current + 1), []),
    refresh: useCallback(() => {
      setPage(1);
      setReloadToken((token) => token + 1);
    }, []),
  };
}

/** Stable empty list so callers can default a filter object without re-running effects. */
export const useNoFilters = () => useMemo<StampTransactionQuery>(() => ({}), []);
