'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  SEARCH_PARAM,
  writeSearchTerm,
} from '@/lib/search-text';
import { cn } from '@/lib/utils';

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Dish, cuisine and restaurant search. On the home page it searches while
 * typing (300 ms after the last key, from 2 characters) and on submit; on
 * other pages a submit opens the home page with the results. The term lives
 * in the `q` query parameter.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === '/';
  const urlTerm = isHome ? (searchParams.get(SEARCH_PARAM) ?? '') : '';

  const [value, setValue] = useState(urlTerm);
  // Follow the URL when it changes elsewhere (a "clear search" button, back).
  const [syncedTerm, setSyncedTerm] = useState(urlTerm);
  if (urlTerm !== syncedTerm) {
    setSyncedTerm(urlTerm);
    setValue(urlTerm);
  }

  const apply = (raw: string) => {
    const term = raw.trim();
    if (term.length > 0 && term.length < MIN_SEARCH_LENGTH) return;
    if (isHome) {
      if (term === urlTerm.trim()) return;
      const query = writeSearchTerm(searchParams.toString(), term);
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    } else if (term) {
      router.push(`/?${writeSearchTerm('', term)}`);
    }
  };

  useEffect(() => {
    if (!isHome) return;
    const timer = setTimeout(() => apply(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `apply` reads the latest URL each render; only typing restarts the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isHome]);

  return (
    <form
      role="search"
      className={cn('relative w-full', className)}
      onSubmit={(event) => {
        event.preventDefault();
        apply(value);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      <input
        type="search"
        value={value}
        maxLength={MAX_SEARCH_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50/50 pl-9 pr-9 text-sm transition-colors placeholder:text-zinc-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            apply('');
          }}
          aria-label={t('search.clear')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
