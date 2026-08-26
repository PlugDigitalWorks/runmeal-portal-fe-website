'use client';

import { useState } from 'react';
import { Product } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { Plus } from 'lucide-react';
import { CartAddonSelection, CartOptionSelection, ProductDetailModal } from './ProductDetailModal';
import { formatCurrencyAmount, getCurrencySymbol } from '@/lib/currency';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

interface ProductListProps {
  products: Product[];
  branchId?: string;
}

export function ProductList({ products, branchId }: ProductListProps) {
  const { addToCart } = useCart();
  const { selectedBranch, setSelectedBranch } = useBranch();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProductClick = (product: Product) => {
    // Set/update selectedBranch if branchId is passed and doesn't match
    if (branchId && (!selectedBranch || selectedBranch.id !== branchId)) {
      // We need to create a minimal branch object for the context
      // The full branch data should ideally come from the parent component
      setSelectedBranch({
        id: branchId,
        name: '',
        addressText: '',
        deliveryRadiusM: 0,
        locationGeog: { type: 'Point', coordinates: [0, 0] },
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
        countryCode: '',
        province: '',
        district: '',
        neighborhood: '',
        street: '',
        buildingNumber: null,
        apartmentNumber: null,
        postalCode: null,
        isActive: true
      });
    }

    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCartFromModal = async (
    product: Product,
    quantity: number,
    options: CartOptionSelection[],
    addons: CartAddonSelection[],
    note?: string,
  ) => {
    await addToCart(product.id, quantity, options, addons, note, product);
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">No products found in this category.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => {
          const currencySymbol = getCurrencySymbol(product);
          const hasDiscountedPrice = product.discountedPrice !== undefined && product.discountedPrice !== null;

          return (
            <div
              key={product.id}
              className="group bg-white rounded-lg border border-zinc-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-row h-32"
            >
              <div className="relative w-32 h-full bg-zinc-100 shrink-0">
                <ImageWithFallback
                  src={product.imageUrl || product.image}
                  alt={product.name}
                  fill
                  sizes="128px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  fallbackClassName="object-contain p-3 opacity-40"
                />
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <h3 className="font-semibold text-zinc-900 leading-tight mb-1 truncate">{product.name}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-2 leading-snug">{product.description}</p>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-lg text-zinc-900">
                    <span className="text-xl font-bold text-orange-600">
                      {formatCurrencyAmount(
                        hasDiscountedPrice ? product.discountedPrice : product.price,
                        currencySymbol,
                      )}
                    </span>
                    {hasDiscountedPrice && (
                      <span className="text-sm pl-1 text-zinc-400 line-through">
                        {formatCurrencyAmount(product.price, currencySymbol)}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 transition-colors shadow-sm active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={handleAddToCartFromModal}
      />
    </>
  );
}
