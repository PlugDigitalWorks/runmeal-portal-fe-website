'use client';

import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { useEffect } from 'react';

import { Branch } from '@/types/branch';
import { Category } from '@/types/category';
import { Product } from '@/types/product';
import { CategoryList } from '@/components/categories/CategoryList';
import { ProductList } from '@/components/products/ProductList';
import { BranchStickyCart } from '@/components/branches/BranchStickyCart';
import { TagBadgeList, TagToggle } from '@/components/tags/TagBadge';
import { useBranch } from '@/context/BranchContext';
import { buildMenuSections, collectProductTags } from '@/lib/menu-tags';
import { sortRestaurantTags, type Tag } from '@/types/tag';
import { MapPin, ArrowLeft, MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BranchViewProps {
  branch: Branch;
  categories: Category[];
  products: Product[];
  /** The restaurant's own tags (cuisine, features). */
  tags?: Tag[];
}

export function BranchView({ branch, categories, products, tags = [] }: BranchViewProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { setSelectedBranch } = useBranch();
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(
    searchParams.get('categoryId') || undefined
  );
  const [activeTagId, setActiveTagId] = useState<string | undefined>();

  // Set the selected branch when viewing this branch page
  useEffect(() => {
    setSelectedBranch(branch);
  }, [branch, setSelectedBranch]);

  const handleCategorySelect = useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId);

    const params = new URLSearchParams(window.location.search);
    if (categoryId) {
      params.set('categoryId', categoryId);
    } else {
      params.delete('categoryId');
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Quick filters: only tags some product carries. A selected tag narrows the
  // menu across categories and hides the categories left empty.
  const quickTags = collectProductTags(products);
  const visibleCategories = activeTagId
    ? buildMenuSections(categories, products, { tagId: activeTagId }).map(section => section.category)
    : categories;
  const categoryId = visibleCategories.some(category => category.id === activeCategoryId)
    ? activeCategoryId
    : undefined;
  const sections = buildMenuSections(categories, products, { categoryId, tagId: activeTagId });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <main className="flex-1 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-zinc-100">
          <div className="container mx-auto px-4 py-6">
            <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-orange-600 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Restaurants
            </Link>

            <div className="flex items-start md:items-center gap-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                <ImageWithFallback
                  src={branch.logoUrl}
                  alt={branch.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                  fallbackClassName="object-contain p-2 opacity-40"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-zinc-900">{branch.name}</h1>
                <TagBadgeList tags={sortRestaurantTags(tags)} className="mt-2" />
                <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  {branch.addressText}
                </div>
                <Link
                  href={`/contact?branchId=${branch.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 underline-offset-4 transition-colors hover:text-orange-700 hover:underline"
                >
                  <MessageSquareText className="h-4 w-4" />
                  {t('contact.title')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Categories (Sticky) */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-100 py-3 mb-6">
          <div className="container mx-auto">
            <CategoryList
              categories={visibleCategories}
              activeCategoryId={categoryId}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </div>

        {quickTags.length > 0 && (
          <div
            role="group"
            aria-label={t('menu.quickFilters')}
            className="container mx-auto px-4 mb-6 flex gap-2 overflow-x-auto scrollbar-hide"
          >
            {quickTags.map(tag => (
              <TagToggle
                key={tag.id}
                tag={tag}
                selected={activeTagId === tag.id}
                onToggle={() => setActiveTagId(current => (current === tag.id ? undefined : tag.id))}
              />
            ))}
          </div>
        )}

        {/* Products, by category */}
        <div className="container mx-auto px-4 space-y-8">
          {sections.length > 0 ? (
            sections.map(({ category, products: sectionProducts }) => (
              <section key={category.id} aria-labelledby={`category-${category.id}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 id={`category-${category.id}`} className="text-lg font-bold text-zinc-900">
                    {category.name}
                  </h2>
                  <TagBadgeList tags={category.tags} />
                </div>
                <ProductList products={sectionProducts} branchId={branch.id} />
              </section>
            ))
          ) : (
            <ProductList products={[]} branchId={branch.id} />
          )}
        </div>
      </main>

      <BranchStickyCart branchId={branch.id} />
    </div>
  );
}
