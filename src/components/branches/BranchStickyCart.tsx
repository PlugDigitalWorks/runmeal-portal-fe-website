'use client';

import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';

interface BranchStickyCartProps {
    branchId: string;
}

export function BranchStickyCart({ branchId }: BranchStickyCartProps) {
    const { openCart } = useCart();

    // Subscribe to cart changes (using context hook) - but getCartByBranch fetches from 'carts' which is reactive.
    // However, we need to re-find the cart when 'carts' changes.
    // Better way: get 'carts' from useCart and find it here so it's reactive.
    const { carts } = useCart();
    const currentCart = carts.find(c => c.branchId === branchId);

    if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
        return null;
    }

    const itemCount = currentCart.items.reduce((acc, item) => acc + item.qty, 0);
    const totalPrice = currentCart.totalCartPrice || 0;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 md:hidden">
            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-500">Total</span>
                    <span className="text-lg font-bold text-orange-600">
                        ₺{totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                
                <Button 
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-xl flex justify-between items-center px-4"
                    onClick={() => openCart(currentCart.id || currentCart.cartId)}
                >
                    <div className="bg-white/20 h-8 w-8 rounded-full flex items-center justify-center">
                        <span className="text-sm">{itemCount}</span>
                    </div>
                    <span>View Cart</span>
                    <ShoppingBag className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
