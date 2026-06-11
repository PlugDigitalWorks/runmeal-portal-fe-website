import { branchService } from '@/services/branch.service';
import { catalogService } from '@/services/catalog.service';
import { BranchView } from '@/components/branches/BranchView';
import { notFound } from 'next/navigation';
import { Branch } from '@/types/branch';
import { Category } from '@/types/category';
import { Product } from '@/types/product';

export default async function BranchBySlugPage({
  params,
}: {
  params: Promise<{ brandSlug: string; branchSlug: string }>;
}) {
  const { brandSlug, branchSlug } = await params;

  let branch: Branch | undefined;

  try {
    branch = await branchService.getBranchBySlugs(brandSlug, branchSlug);
  } catch (err) {
    console.error(`FAILED to fetch branch for ${brandSlug}/${branchSlug}`, err);
  }

  if (!branch) {
    return notFound();
  }

  let categories: Category[] = [];
  let products: Product[] = [];

  // Branch-scoped menu so products/categories disabled for this branch are excluded.
  try {
    ({ categories, products } = await catalogService.getBranchCatalog(branch.id));
  } catch (err) {
    console.error(`FAILED to fetch branch menu for branch: ${branch.id}`, err);
    categories = [];
    products = [];
  }

  return (
    <BranchView
      branch={branch}
      categories={categories}
      products={products}
    />
  );
}
