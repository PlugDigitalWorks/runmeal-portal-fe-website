'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { TagIcon } from '@/components/tags/tag-icons';
import { TagToggle, useTagName } from '@/components/tags/TagBadge';
import { MAX_TAG_FILTERS } from '@/lib/tag-filters';
import { cn } from '@/lib/utils';
import type { PortalTagGroups, Tag } from '@/types/tag';

interface TagFiltersProps {
  tags: PortalTagGroups;
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * The portal's restaurant filters: cuisines as large buttons, features and
 * dishes in a panel, and the selection as removable chips. Every selected tag
 * must match.
 */
export function TagFilters({ tags, selectedIds, onChange }: TagFiltersProps) {
  const { t } = useTranslation();
  const nameOf = useTagName();

  const selected = new Set(selectedIds);
  const atLimit = selectedIds.length >= MAX_TAG_FILTERS;
  const panelTags = [...tags.feature, ...tags.product];
  const panelCount = panelTags.filter((tag) => selected.has(tag.id)).length;
  const byId = new Map([...tags.cuisine, ...panelTags].map((tag) => [tag.id, tag]));
  const selectedTags = selectedIds.flatMap((id) => byId.get(id) ?? []);

  const toggle = (tag: Tag) =>
    onChange(selected.has(tag.id) ? selectedIds.filter((id) => id !== tag.id) : [...selectedIds, tag.id]);

  const panelSections = [
    { key: 'feature', title: t('home.featuresTitle'), items: tags.feature },
    { key: 'product', title: t('home.dishesTitle'), items: tags.product },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-4 mb-6">
      {tags.cuisine.length > 0 && (
        <div role="group" aria-label={t('home.cuisines')} className="-mx-4 overflow-x-auto scrollbar-hide px-4">
          <div className="flex gap-3 min-w-max pb-1">
            {tags.cuisine.map((tag) => {
              const isSelected = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={atLimit && !isSelected}
                  onClick={() => toggle(tag)}
                  className={cn(
                    'flex w-24 flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none',
                    isSelected
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-zinc-100 bg-white text-zinc-700 shadow-sm hover:border-orange-200 hover:text-orange-600',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      isSelected ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600',
                    )}
                  >
                    <TagIcon icon={tag.icon} className="h-6 w-6" />
                  </span>
                  <span className="w-full truncate text-center">{nameOf(tag)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {panelSections.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-white">
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                {panelCount ? t('home.filtersCount', { count: panelCount }) : t('home.filters')}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full bg-white sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">{t('home.filters')}</SheetTitle>
                <SheetDescription className={cn(!atLimit && 'sr-only')}>
                  {t('home.maxFilters', { count: MAX_TAG_FILTERS })}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-6 overflow-y-auto px-4">
                {panelSections.map((section) => (
                  <section key={section.key} aria-label={section.title}>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-900">{section.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {section.items.map((tag) => (
                        <TagToggle
                          key={tag.id}
                          tag={tag}
                          selected={selected.has(tag.id)}
                          disabled={atLimit}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <SheetFooter className="flex-row gap-2 border-t border-zinc-100">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={!selectedIds.length}
                  onClick={() => onChange([])}
                >
                  {t('home.clearFilters')}
                </Button>
                <SheetClose asChild>
                  <Button className="flex-1">{t('home.showRestaurants')}</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}

        {selectedTags.length > 0 && (
          <>
            <ul aria-label={t('home.selectedFilters')} className="flex flex-wrap items-center gap-2">
              {selectedTags.map((tag) => (
                <li
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-600 py-1 pl-3 pr-1 text-sm font-medium text-white"
                >
                  {nameOf(tag)}
                  <button
                    type="button"
                    aria-label={t('home.removeFilter', { name: nameOf(tag) })}
                    onClick={() => toggle(tag)}
                    className="rounded-full p-1 hover:bg-orange-700"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-sm font-medium text-orange-600 underline-offset-4 hover:text-orange-700 hover:underline"
            >
              {t('home.clearFilters')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
