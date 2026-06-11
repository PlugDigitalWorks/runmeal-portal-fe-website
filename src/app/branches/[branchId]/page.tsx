import { branchService } from '@/services/branch.service';
import { catalogService } from '@/services/catalog.service';
import { BranchView } from '@/components/branches/BranchView';
import { notFound, redirect } from 'next/navigation';
import { Branch } from '@/types/branch';
import { Category } from '@/types/category';
import { Product } from '@/types/product';

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

  // Branch-scoped menu so products/categories disabled for this branch are excluded.
  try {
    ({ categories, products } = await catalogService.getBranchCatalog(branch.id));
  } catch (err) {
    console.error(`FAILED to fetch branch menu for branch: ${branchId}`, err);
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
