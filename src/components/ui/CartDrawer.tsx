'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Branch } from '@/types/branch';
import { branchService } from '@/services/branch.service';
import Image from 'next/image';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import { CartDetail } from './CartDetail';
import { useTranslation } from 'react-i18next';

export function CartDrawer() {
    const { t } = useTranslation();
    const { carts, clearCart, isCartOpen, closeCart, selectedCartId, openCart, updateQty, removeItem, refreshCarts } = useCart();
    const router = useRouter();
    const { user, addresses } = useUser();

    // Derived state for local drawer control handled by context now
    const [localBranchDetails, setLocalBranchDetails] = useState<Record<string, Branch>>({});

    // Calculate total active carts
    const activeCartsCount = carts.filter(c => c.isActive).length;

    useEffect(() => {
        const loadBranchDetails = async () => {
            const newDetails: Record<string, Branch> = { ...localBranchDetails };
            let hasChanges = false;

            for (const cart of carts) {
                if (!newDetails[cart.branchId]) {
                    try {
                        const branch = await branchService.getBranchDetails(cart.branchId);
                        newDetails[cart.branchId] = branch;
                        hasChanges = true;
                    } catch (error) {
                        console.error('Failed to fetch branch details', error);
                    }
                }
            }

            if (hasChanges) {
                setLocalBranchDetails(newDetails);
            }
        };

        if (isCartOpen && carts.length > 0) {
            loadBranchDetails();
        }
    }, [isCartOpen, carts, localBranchDetails]);

    const activeAddressId = addresses?.find(a => a.isActive)?.id;

    // Refresh carts when active address changes
    useEffect(() => {
        if (user && activeAddressId) {
            refreshCarts();
        }
    }, [activeAddressId, user, refreshCarts]);

    if (!user) return null;

    return (
        <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10" onClick={() => openCart()}>
                    <ShoppingBag className="h-5 w-5" />
                    {activeCartsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                            {activeCartsCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col h-dvh">
                {selectedCartId && carts.find(c => (c.cartId || c.id) === selectedCartId) ? (
                    <CartDetail
                        cart={carts.find(c => (c.cartId || c.id) === selectedCartId)!}
                        branch={localBranchDetails[carts.find(c => (c.cartId || c.id) === selectedCartId)!.branchId]}
                        onClose={() => closeCart()}
                        onBack={() => openCart(undefined)} // Reset selected cart
                    />
                ) : (
                    <>
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white text-zinc-900">
                            <SheetTitle className="font-bold text-lg">{t('cart.allCarts')}</SheetTitle>
                            <SheetDescription className="sr-only">
                                {t('cart.manageDescription')}
                            </SheetDescription>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 space-y-4">
                            {carts.filter(c => c.isActive).length === 0 ? (
                                <div className="text-center text-zinc-500 mt-10">
                                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>{t('cart.empty')}</p>
                                </div>
                            ) : (
                                carts.filter(c => c.isActive).map(cart => {
                                    const branch = localBranchDetails[cart.branchId];
                                    const cartId = cart.cartId || cart.id || '';

                                    if (!cartId) return null;

                                    return (
                                        <div key={cartId} className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4">
                                            {/* Branch Header */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    {/* Branch Image Mockup or from data if available. Branch type might have image? */}
                                                    <div className="h-10 w-10 bg-zinc-100 rounded-lg overflow-hidden relative">
                                                        {/* Fallback or real image */}
                                                        <ShoppingBag className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-zinc-900 line-clamp-1">
                                                            {branch?.name || t('cart.loading')}
                                                        </h3>
                                                        <p className="text-xs text-zinc-500">
                                                            {/* Delivery info mock or real */}
                                                            {t('cart.deliveryInfo')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => clearCart(cartId)}
                                                    className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Items */}
                                            <div className="space-y-4 mb-4">
                                                {(cart.items || []).map(item => (
                                                    <div key={item.id} className="flex gap-3">
                                                        <div className="h-16 w-16 bg-zinc-50 rounded-lg relative overflow-hidden shrink-0">
                                                            <Image
                                                                src={item.imgUrl || DEFAULT_PRODUCT_IMAGE}
                                                                alt={item.productName || ''}
                                                                fill
                                                                className={item.imgUrl ? 'object-cover' : 'object-contain p-1.5 opacity-90'}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="text-sm font-medium text-zinc-900 line-clamp-2">
                                                                    {item.productName}
                                                                </h4>
                                                                <span className="text-sm font-semibold text-zinc-900 shrink-0">
                                                                    ₺{item.price.toFixed(2)}
                                                                </span>
                                                            </div>
                                                            {/* Options display */}
                                                            {item.options && item.options.length > 0 && (
                                                                <div className="mt-1 space-y-0.5">
                                                                    {item.options.map((optGroup, idx) => (
                                                                        <p key={idx} className="text-xs text-zinc-500">
                                                                            {optGroup.groupName}: {optGroup.selections.map(s => s.optionName).join(', ')}
                                                                            {optGroup.selections.some(s => s.priceDelta > 0) && (
                                                                                <span className="text-zinc-400 ml-1">
                                                                                    (+₺{optGroup.selections.reduce((acc, s) => acc + (s.priceDelta || 0), 0).toFixed(0)})
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {item.note ? (
                                                                <p className="mt-1 break-words text-xs text-zinc-500">
                                                                    {t('cart.note')}: {item.note}
                                                                </p>
                                                            ) : null}
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (item.qty > 1) {
                                                                                updateQty(item.id, item.qty - 1);
                                                                            } else {
                                                                                removeItem(item.id);
                                                                            }
                                                                        }}
                                                                        className="h-6 w-6 flex items-center justify-center rounded-md bg-white shadow-sm hover:bg-zinc-50 transition-colors"
                                                                    >
                                                                        <Minus className="h-3 w-3 text-zinc-600" />
                                                                    </button>
                                                                    <span className="text-xs font-semibold text-zinc-900 w-6 text-center">{item.qty}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateQty(item.id, item.qty + 1);
                                                                        }}
                                                                        className="h-6 w-6 flex items-center justify-center rounded-md bg-white shadow-sm hover:bg-zinc-50 transition-colors"
                                                                    >
                                                                        <Plus className="h-3 w-3 text-zinc-600" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Footer */}
                                            <div className="border-t border-zinc-100 pt-3">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm text-zinc-500">{t('cart.subtotal')}</span>
                                                    <span className="text-sm text-zinc-900">₺{cart.totalCartPrice?.toFixed(2) ?? '0.00'}</span>
                                                </div>
                                                {cart.discountAmount && cart.discountAmount > 0 ? (
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-sm text-zinc-500">{t('cart.discount')}</span>
                                                        <span className="text-sm text-green-600">-₺{cart.discountAmount.toFixed(2)}</span>
                                                    </div>
                                                ) : null}
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-sm text-zinc-500">{t('cart.finalTotal')}</span>
                                                    <span className="font-bold text-zinc-900">₺{(cart.finalPrice ?? cart.totalCartPrice ?? 0).toFixed(2)}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <Button
                                                        variant="outline"
                                                        className="w-full border-zinc-300 text-zinc-900 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                                                        onClick={() => {
                                                            closeCart();
                                                            router.push(`/branches/${cart.branchId}`);
                                                        }}
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        {t('cart.addMoreItems')}
                                                    </Button>
                                                    <Button className="w-full bg-white border border-zinc-900 text-zinc-900 hover:bg-zinc-50"
                                                        onClick={() => {
                                                            closeCart();
                                                            router.push(`/checkout?cartId=${cartId}`);
                                                        }}
                                                    >
                                                        {t('cart.proceedToCheckout')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
