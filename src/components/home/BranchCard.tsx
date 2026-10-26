'use client';

import Link from 'next/link';
import { MapPin, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { TagBadgeList, useTagName } from '@/components/tags/TagBadge';
import { formatDistance } from '@/lib/geo';
import { writeSearchTerm } from '@/lib/search-text';
import { Branch } from '@/types/branch';
import { sortRestaurantTags, type Tag } from '@/types/tag';

interface BranchCardProps {
  branch: Branch;
  /** The selected product tags; the card says it sells a dish carrying them. */
  productTags: Tag[];
  /**
   * Only when the visitor gave a location: without one `distanceM` is from
   * the default city's centre, which means nothing to them.
   */
  showDistance: boolean;
  /** The search that found the restaurant; its page opens with it. */
  searchTerm?: string;
}

export function BranchCard({ branch, productTags, showDistance, searchTerm }: BranchCardProps) {
  const { t, i18n } = useTranslation();
  const nameOf = useTagName();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? 'tr';

  // Mid-sentence in English ("Has vegan dishes"); Turkish opens with the name.
  const dishTags = productTags.map((tag) =>
    language.startsWith('en') ? nameOf(tag).toLocaleLowerCase('en') : nameOf(tag),
  );

  const path = branch.brandSlug && branch.slug ? `/${branch.brandSlug}/${branch.slug}` : `/branches/${branch.id}`;
  const query = searchTerm ? writeSearchTerm('', searchTerm) : '';

  return (
    <Link
      href={query ? `${path}?${query}` : path}
      className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-zinc-100 block"
    >
      <div className="h-40 bg-zinc-100 relative">
        <ImageWithFallback
          src={branch.bannerUrls?.[0]}
          alt={branch.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>
      <div className="p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-2">{branch.name}</h3>
        <TagBadgeList tags={sortRestaurantTags(branch.tags ?? []).slice(0, 3)} className="mb-3" />
        <div className="space-y-2 text-sm text-zinc-600">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{branch.addressText}</span>
          </div>
          {dishTags.length > 0 && (
            <div className="flex items-start gap-2 text-zinc-700">
              <UtensilsCrossed className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                {t('home.hasDishes', {
                  tags: new Intl.ListFormat(language, { type: 'conjunction' }).format(dishTags),
                })}
              </span>
            </div>
          )}
          {showDistance && typeof branch.distanceM === 'number' && (
            <div className="text-xs font-medium text-orange-600 mt-2">{formatDistance(branch.distanceM, language)}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
