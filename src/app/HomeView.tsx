'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '@/context/UserContext';
import { BranchCard } from '@/components/home/BranchCard';
import { TagFilters } from '@/components/home/TagFilters';
import { LocationNotice } from '@/components/location/LocationNotice';
import { useSearchLocation } from '@/context/LocationContext';
import { Button } from '@/components/ui/button';
import { useNearbyBranches } from '@/hooks/useNearbyBranches';
import { TAG_FILTER_PARAM, readTagFilter, writeTagFilter } from '@/lib/tag-filters';
import { SEARCH_PARAM, readSearchTerm } from '@/lib/search-text';
import { portalService } from '@/services/portal.service';
import { setSignupBranchId } from '@/lib/signup-branch';
import type { PortalTagGroups } from '@/types/tag';
import { MapPin, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function HomeSpinner() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-600"></div>
    </div>
  );
}

export function HomeView() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, addresses, isLoading: isContextLoading, tempAddress } = useUser();
  const location = useSearchLocation();
  const [tagGroups, setTagGroups] = useState<PortalTagGroups | null>(null);

  const activeAddress = user ? addresses.find(a => a.isActive) : undefined;
  const selectedTagIds = readTagFilter(searchParams);
  const searchTerm = readSearchTerm(searchParams);

  // The term and the selected tags stay in the URL so a search can be shared and reloaded.
  const replaceQuery = (query: string) =>
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  const setSelectedTagIds = (tagIds: string[]) => replaceQuery(writeTagFilter(searchParams.toString(), tagIds));
  const clearSearchAndFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(SEARCH_PARAM);
    next.delete(TAG_FILTER_PARAM);
    replaceQuery(next.toString());
  };

  const { branches, meta, isLoading: isLoadingBranches, isLoadingMore, hasMore, loadMore } = useNearbyBranches({
    location: location.coords,
    q: searchTerm,
    tagIds: selectedTagIds,
    // Without a location the default city loads at once; a location that
    // arrives later replaces it.
    enabled: location.isReady,
    onInvalidQuery: clearSearchAndFilters,
  });

  // A sign-up started from the restaurant list belongs to no restaurant.
  useEffect(() => {
    setSignupBranchId(null);
  }, []);

  useEffect(() => {
    portalService.getTags().then(setTagGroups).catch((error) => {
      console.error('Failed to fetch tags', error);
    });
  }, []);

  const selectedProductTags = tagGroups?.product.filter(tag => selectedTagIds.includes(tag.id)) ?? [];

  if (isContextLoading) {
    return <HomeSpinner />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <main className="flex-1 pb-20">
        {/* Hero Section */}
        <section className="relative h-[300px] md:h-[400px] w-full overflow-hidden bg-zinc-900">
           <div className="absolute inset-0 bg-linear-to-r from-zinc-800 to-zinc-800/10 z-10" />
           <Image 
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80"
              alt="Food Hero"
              fill
              className="object-cover opacity-80"
              priority
           />
           
           <div className="relative z-20 container mx-auto px-4 h-full flex flex-col justify-center">
             <div className="max-w-xl space-y-4">
                 <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                    {t('home.heroTitlePrefix')}<span className="text-orange-500">{t('home.heroTitleHighlight')}</span>{t('home.heroTitleSuffix')}
                 </h1>
                 <p className="text-zinc-300 text-lg md:text-xl max-w-md">
                    {t('home.heroSubtitle')}
                 </p>
                 {(activeAddress || tempAddress) && (
                     <div className="flex items-center gap-2 text-orange-200 bg-black/30 w-fit px-4 py-2 rounded-lg backdrop-blur-sm">
                         <MapPin className="h-4 w-4" />
                         <span className="text-sm">
                             {t('home.deliveringTo')} {tempAddress ? tempAddress.formattedAddress : activeAddress?.street}
                             {activeAddress && !tempAddress && ` ${t('home.active')}`}
                             {tempAddress && ` ${t('home.temporary')}`}
                         </span>
                     </div>
                 )}
             </div>
           </div>
        </section>

        {/* Branches Section */}
        <section className="container mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-zinc-900 mb-6">{t('home.nearbyRestaurants')}</h2>
            <LocationNotice location={location} />
            {tagGroups && (
                <TagFilters tags={tagGroups} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
            )}
            {!isLoadingBranches && meta && meta.total > 0 && (
                <p role="status" className="mb-4 text-sm text-zinc-500">
                    {t('home.resultsCount', { count: meta.total })}
                </p>
            )}


            {isLoadingBranches ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-64 bg-zinc-200 rounded-xl animate-pulse" />
                    ))}
                 </div>
            ) : branches.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {branches.map(branch => (
                            <BranchCard
                                key={branch.id}
                                branch={branch}
                                productTags={selectedProductTags}
                                showDistance={!!location.coords}
                                searchTerm={searchTerm}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <div className="mt-8 flex justify-center">
                            <Button variant="outline" className="bg-white" isLoading={isLoadingMore} onClick={loadMore}>
                                {t('home.loadMore')}
                            </Button>
                        </div>
                    )}
                </>
            ) : searchTerm ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-zinc-300">
                    <div className="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                        <SearchX className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">{t('home.noResultsForTerm', { term: searchTerm })}</h3>
                    <Button variant="outline" size="sm" className="mt-4" onClick={clearSearchAndFilters}>
                        {t('home.clearSearchAndFilters')}
                    </Button>
                </div>
            ) : selectedTagIds.length > 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-zinc-300">
                    <div className="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                        <SearchX className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">{t('home.noMatches')}</h3>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setSelectedTagIds([])}>
                        {t('home.clearAllFilters')}
                    </Button>
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-zinc-300">
                    <div className="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">{t('home.noRestaurants')}</h3>
                    <p className="text-zinc-500 max-w-sm mx-auto mt-2">
                        {t('home.noRestaurantsHelp')}
                    </p>
                </div>
            )}
        </section>

      </main>
    </div>
  );
}
