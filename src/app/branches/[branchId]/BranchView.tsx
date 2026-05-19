'use client';

import Image from 'next/image';
import { useEffect } from 'react';

import { Branch } from '@/types/branch';
import { Category } from '@/types/category';
import { Product } from '@/types/product';
import { CategoryList } from '@/components/categories/CategoryList';
import { ProductList } from '@/components/products/ProductList';
import { BranchStickyCart } from '@/components/branches/BranchStickyCart';
import { useBranch } from '@/context/BranchContext';
import { MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

interface BranchViewProps {
  branch: Branch;
  categories: Category[];
  products: Product[];
}

export function BranchView({ branch, categories, products }: BranchViewProps) {
  const searchParams = useSearchParams();
  const { setSelectedBranch } = useBranch();
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(
    searchParams.get('categoryId') || undefined
  );

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

  // Filter products based on active category
  const filteredProducts = activeCategoryId
    ? products.filter(product => product.categoryId === activeCategoryId)
    : products;

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
                <Image
                  src={branch.logoUrl || '/logo.svg'}
                  alt={branch.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">{branch.name}</h1>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  {branch.addressText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories (Sticky) */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-100 py-3 mb-6">
          <div className="container mx-auto">
            <CategoryList
              categories={categories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </div>

        {/* Products */}
        <div className="container mx-auto px-4">
          <ProductList products={filteredProducts} branchId={branch.id} />
        </div>
      </main>

      <BranchStickyCart branchId={branch.id} />
    </div>
  );
}
