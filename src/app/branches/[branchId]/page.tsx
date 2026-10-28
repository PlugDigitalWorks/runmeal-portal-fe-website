import { branchService } from '@/services/branch.service';
import { catalogService } from '@/services/catalog.service';
import { BranchView } from '@/components/branches/BranchView';
import { notFound, redirect } from 'next/navigation';
import { Branch } from '@/types/branch';
import { Category } from '@/types/category';
import { Product } from '@/types/product';
import type { Tag } from '@/types/tag';

export default async function BranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { branchId } = await params;
  // const { categoryId } = await searchParams; // Filter is now client side only

  let branch: Branch | undefined;
  let categories: Category[] = [];
  let products: Product[] = [];

  try {
    branch = await branchService.getBranchDetails(branchId);
  } catch (err) {
    console.error(`FAILED to fetch Branch Details for ID: ${branchId}`, err);
  }

  if (!branch) {
    console.error('Branch not found', branch);
    return notFound();
  }

  // Redirect id-based URLs to the canonical /:brandSlug/:branchSlug URL.
  if (branch.brandSlug && branch.slug) {
    redirect(`/${branch.brandSlug}/${branch.slug}`);
  }

  // The restaurant's tags are decoration: the page renders without them.
  const tagsRequest = branchService.getBranchTags(branch.id).catch((err): Tag[] => {
    console.error(`FAILED to fetch tags for branch: ${branch.id}`, err);
    return [];
  });

  // Branch-scoped menu so products/categories disabled for this branch are excluded.
  try {
    ({ categories, products } = await catalogService.getBranchCatalog(branch.id));
  } catch (err) {
    console.error(`FAILED to fetch branch menu for branch: ${branchId}`, err);
    categories = [];
    products = [];
  }

  const tags = await tagsRequest;

  return (
    <BranchView
      branch={branch}
      categories={categories}
      products={products}
      tags={tags}
    />
  );
}
