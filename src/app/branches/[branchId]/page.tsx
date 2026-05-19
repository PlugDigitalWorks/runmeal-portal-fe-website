import { branchService } from '@/services/branch.service';
import { catalogService } from '@/services/catalog.service';
import { BranchView } from './BranchView';
import { notFound } from 'next/navigation';
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

  try {
    const categoriesData = await catalogService.getCategories(branch.id, branch.brandId);
    categories = Array.isArray(categoriesData) ? categoriesData : [];
  } catch (err) {
    console.error('FAILED to fetch Categories', err);
    categories = []; // Fallback to empty
  }

  try {
    const productsData = await catalogService.getProducts(branch.id, {
      brandId: branch.brandId,
    });
    products = Array.isArray(productsData) ? productsData : [];
  } catch (err) {
    console.error(`FAILED to fetch Products for branch: ${branchId}`, err);
    products = []; // Fallback to empty
  }

  return (
    <BranchView 
      branch={branch}
      categories={categories}
      products={products}
    />
  );
}
