'use client';

import { Cart, CartItem, getCartId } from '@/types/cart';
import { Branch } from '@/types/branch';
import { Button } from '@/components/ui/button';
import { X, Trash2, Plus, Minus } from 'lucide-react';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { CartPromotions } from '@/components/cart/CartPromotions';
import { DiscountedLinePrice } from '@/components/ui/DiscountedLinePrice';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface CartDetailProps {
    cart: Cart;
    branch?: Branch;
    onClose: () => void;
    onBack?: () => void;
}

export function CartDetail({ cart, branch, onClose }: CartDetailProps) {
    const { t } = useTranslation();
    const { updateQty, removeItem } = useCart();
    const router = useRouter();

    // Every amount below comes from the backend; the client never computes discounts.
    const cartId = getCartId(cart);
    const cartTotal = cart.totalCartPrice || 0;
    const discountAmount = cart.discountAmount || 0;
    const finalTotal = cart.finalPrice ?? cartTotal;

    const handleQtyChange = (item: CartItem, change: number) => {
        const newQty = item.qty + change;
        if (newQty <= 0) {
            removeItem(item.id);
        } else {
            updateQty(item.id, newQty);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h2 className="font-bold text-xl text-zinc-900">{t('cart.myCart')}</h2>
                    <p className="text-sm text-zinc-500 line-clamp-1">{branch?.name || t('cart.restaurant')}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-zinc-100">
                    <X className="h-5 w-5 text-zinc-500" />
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-6">
                
                    {/* Products */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-zinc-900">{t('cart.yourItems')}</h3>
                        <div className="space-y-4 bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
                            {(cart.items || []).map(item => (
                                <div key={item.id} className="flex gap-4">
                                     <div className="h-16 w-16 bg-zinc-50 rounded-lg relative overflow-hidden shrink-0">
                                        <ImageWithFallback
                                            src={item.imgUrl}
                                            alt={item.productName || ''}
                                            fill
                                            sizes="64px"
                                            className="object-cover"
                                            fallbackClassName="object-contain p-1.5 opacity-40"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-medium text-zinc-900 line-clamp-2">{item.productName}</h4>
                                        </div>
                                        <p className="text-xs text-zinc-500 mb-3">{t('cart.portion')}</p>
                                        {item.note ? (
                                            <p className="mb-3 break-words text-xs text-zinc-500">{t('cart.note')}: {item.note}</p>
                                        ) : null}
                                        
                                        <div className="flex justify-between items-center">
                                            <DiscountedLinePrice
                                                className="font-semibold text-zinc-900"
                                                lineTotal={item.lineTotal}
                                                discountAmount={item.discountAmount}
                                                finalLineTotal={item.finalLineTotal}
                                                fallbackTotal={item.price * item.qty}
                                            />
                                            
                                            <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-full px-2 py-1 shadow-sm">
                                                <button 
                                                    onClick={() => item.qty === 1 ? removeItem(item.id) : handleQtyChange(item, -1)}
                                                    className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors"
                                                >
                                                    {item.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                                </button>
                                                <span className="text-sm font-medium text-zinc-900 min-w-[12px] text-center">{item.qty}</span>
                                                <button 
                                                     onClick={() => handleQtyChange(item, 1)}
                                                    className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-green-600 transition-colors"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                         <button 
                            className="w-full py-3 flex items-center justify-center gap-2 text-zinc-900 font-medium hover:bg-zinc-100 rounded-xl transition-colors dashed border border-zinc-300"
                            onClick={() => {
                                onClose();
                                router.push(`/branches/${cart.branchId}`);
                            }}
                         >
                            <Plus className="h-4 w-4" />
                            {t('cart.addMoreItems')}
                        </button>
                    </div>

                    {/* Loyalty Campaigns (Rekonect) */}
                    {cartId ? (
                        <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
                            <CartPromotions
                                cartId={cartId}
                                appliedPromotions={cart.appliedPromotions}
                                cartItems={cart.items}
                                menuHref={cart.branchId ? `/branches/${cart.branchId}` : '/'}
                            />
                        </div>
                    ) : null}

                    {/* Cost Summary */}
                     <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm space-y-2 text-sm">
                          <div className="flex justify-between text-zinc-900">
                             <span>{t('cart.subtotal')}</span>
                             <span>₺{cartTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         {discountAmount > 0 ? (
                             <div className="flex justify-between text-green-600">
                                 <span>{t('cart.discount')}</span>
                                 <span>-₺{discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                             </div>
                         ) : null}
                         <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold text-zinc-900">
                             <span>{t('cart.finalTotal')}</span>
                             <span>₺{finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white p-4 border-t border-zinc-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                 <div className="flex justify-between items-center mb-4">
                     <span className="font-bold text-zinc-900">{t('cart.total')} <span className="text-xs font-normal text-zinc-500">{t('cart.feesIncluded')}</span></span>
                     <div className="text-right">
                         <div className="font-bold text-emerald-600 text-lg">₺{finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                     </div>
                 </div>
                 <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 text-md rounded-xl"
                    onClick={() => {
                        onClose();
                        router.push(`/checkout?cartId=${cart.id || cart.cartId}`);
                    }}
                 >
                     {t('cart.confirmCart')}
                 </Button>
            </div>
        </div>
    );
}
