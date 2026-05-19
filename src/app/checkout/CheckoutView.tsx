'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { MapPin, User as UserIcon, CheckCircle2, Loader2, Plus, Ticket, Wallet, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { paymentService } from '@/services/payment.service';
import { userService } from '@/services/user.service';
import { walletService, WalletBalance } from '@/services/wallet.service';
import { AxiosError } from 'axios';
import { AddressForm } from '@/components/address/AddressForm';



export default function CheckoutView() {
    const { user, addresses, refreshAddresses } = useUser();
    const { carts, isCartOpen, closeCart, applyCoupon, removeCoupon, availablePromotions, checkAvailablePromotions } = useCart();
    const { selectedBranch } = useBranch();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [deliveryError, setDeliveryError] = useState<string | null>(null);

    // Coupon states
    const [couponCode, setCouponCode] = useState('');
    const [isCouponLoading, setIsCouponLoading] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);

    // Wallet states
    const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
    const [walletAmountInput, setWalletAmountInput] = useState('');
    const [walletAppliedAmount, setWalletAppliedAmount] = useState(0);

    // Determine which cart to show
    const cartIdParam = searchParams.get('cartId');
    const selectedCart = cartIdParam
        ? carts.find(c => (c.cartId || c.id) === cartIdParam)
        : carts.find(c => c.items && c.items.length > 0);

    useEffect(() => {
        if (isCartOpen) {
            closeCart();
        }
    }, [isCartOpen, closeCart]);

    useEffect(() => {
        if (!selectedAddressId && addresses && addresses.length > 0) {
            const active = addresses.find(a => a.isActive);
            const timer = setTimeout(() => {
                setSelectedAddressId(active ? active.id : addresses[0].id);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [addresses, selectedAddressId]);

    useEffect(() => {
        if (deliveryError) {
            setDeliveryError(null);
        }
    }, [selectedAddressId, deliveryError]);

    // Fetch Wallet Balance
    useEffect(() => {
        if (user) {
            walletService.getBalance()
                .then(setWalletBalance)
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [user]);


    if (!user) {
        return <div className="p-8 text-center">Please login to continue.</div>;
    }

    if (!selectedCart || !selectedCart.items || selectedCart.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h1 className="text-2xl font-bold text-zinc-900">Your cart is empty</h1>
                <Button onClick={() => router.push('/')}>Go to Home</Button>
            </div>
        );
    }

    const items = selectedCart.items;
    const subtotal = selectedCart.totalCartPrice || 0;
    const deliveryFee = 0;
    const finalTotal = Math.max(0, (selectedCart.finalPrice ?? selectedCart.totalCartPrice ?? subtotal) - walletAppliedAmount);

    // --- Coupon Handlers ---
    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setIsCouponLoading(true);
        try {
            await applyCoupon(couponCode);
            setCouponCode('');
        } catch (error) {
            // Error handled in context
        } finally {
            setIsCouponLoading(false);
        }
    };

    const handleApplySpecificCoupon = async (code: string) => {
        setIsCouponLoading(true);
        try {
            await applyCoupon(code);
            setShowCouponModal(false);
        } catch (error) {
            // Error handled in context
        } finally {
            setIsCouponLoading(false);
        }
    };

    const handleRemoveCoupon = async () => {
        setIsCouponLoading(true);
        try {
            await removeCoupon();
        } finally {
            setIsCouponLoading(false);
        }
    };

    // --- Wallet Handlers ---
    const handleApplyWallet = (amountOverride?: number) => {
        if (!walletBalance) return;

        let amount = amountOverride;
        if (amount === undefined) {
            if (!walletAmountInput) return;
            amount = parseFloat(walletAmountInput);
        }

        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (amount > walletBalance.balance) {
            toast.error('Amount cannot exceed wallet balance');
            return;
        }

        const totalToPay = selectedCart?.finalPrice ?? selectedCart?.totalCartPrice ?? 0;
        if (amount > totalToPay) {
            amount = totalToPay;
        }

        setWalletAppliedAmount(amount);
        setWalletAmountInput('');
        toast.success('Wallet applied');
    };

    const handleUseMaxWallet = () => {
        if (!walletBalance || !selectedCart) return;
        const totalToPay = selectedCart.finalPrice ?? selectedCart.totalCartPrice ?? 0;
        const maxAmount = Math.min(walletBalance.balance, totalToPay);
        handleApplyWallet(maxAmount);
    };

    const handleRemoveWallet = () => {
        setWalletAppliedAmount(0);
        toast.success('Wallet removed');
    };

    // --- Checkout Handler ---
    const handleCompleteOrder = async () => {
        if (!selectedCart) {
            toast.error('No cart found');
            return;
        }

        setDeliveryError(null);

        try {
            setIsProcessing(true);

            const selectedAddr = addresses.find(a => a.id === selectedAddressId);
            if (selectedAddr && !selectedAddr.isActive) {
                await userService.updateAddress(selectedAddressId, { isActive: true });
            }

            const cartId = selectedCart.cartId || selectedCart.id || '';
            const paymentResponse = await paymentService.initializePayment(
                cartId,
                'ONLINE_CARD',
                'DELIVERY',
                walletAppliedAmount > 0 ? walletAppliedAmount : undefined
            );

            if (paymentResponse.paymentUrl) {
                window.location.href = paymentResponse.paymentUrl;
            } else if (paymentResponse.checkoutFormContent) {
                document.write(paymentResponse.checkoutFormContent);
            } else {
                toast.success('Order placed successfully!');
                router.push('/profile?tab=orders');
                closeCart();
            }

        } catch (error) {
            console.error('Order/Payment Error:', error);
            const axiosError = error as AxiosError<{ message: string, statusCode?: number }>;
            const msg = axiosError.response?.data?.message || 'Failed to complete order. Please try again.';

            if (axiosError.response?.status === 400 && msg.toLowerCase().includes('deliver to your current address')) {
                setDeliveryError(msg);
                toast.error(msg);
            } else {
                toast.error(msg);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddressSuccess = async () => {
        await refreshAddresses();
        setIsAddingAddress(false);
        setDeliveryError(null);
    };

    return (
        <div className="min-h-screen bg-zinc-50 py-8 pb-32">
            <div className="container mx-auto px-4 max-w-4xl">
                <h1 className="text-3xl font-bold text-zinc-900 mb-8">Checkout</h1>

                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">

                        {/* Delivery Address */}
                        <Card className={`border-zinc-200 shadow-sm ${deliveryError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <CardTitle className="flex items-center justify-between text-lg">
                                    <div className="flex items-center gap-2">
                                        <MapPin className={`h-5 w-5 ${deliveryError ? 'text-red-500' : 'text-orange-600'}`} />
                                        <span className={deliveryError ? 'text-red-600' : ''}>Delivery Address</span>
                                    </div>
                                    {!isAddingAddress && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => { setIsAddingAddress(true); setDeliveryError(null); }}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Add New
                                        </Button>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {deliveryError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                        <div className="shrink-0 mt-0.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold">Delivery Unavailable</p>
                                            <p>{deliveryError} Please select a different address or add a new one.</p>
                                        </div>
                                    </div>
                                )}

                                {isAddingAddress ? (
                                    <AddressForm
                                        onCancel={() => setIsAddingAddress(false)}
                                        onSuccess={handleAddressSuccess}
                                    />
                                ) : (
                                    <>
                                        {addresses && addresses.length > 0 ? (
                                            <div className="space-y-4">
                                                {addresses.map(addr => (
                                                    <div
                                                        key={addr.id}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr.id
                                                                ? 'border-orange-600 bg-orange-50/50'
                                                                : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                                                            }`}
                                                        onClick={() => setSelectedAddressId(addr.id)}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <div className="font-semibold text-zinc-900">{addr.province}, {addr.district}</div>
                                                                <div className="text-sm text-zinc-500 mt-1">{addr.street} No: {addr.buildingNumber}</div>
                                                            </div>
                                                            {selectedAddressId === addr.id && (
                                                                <CheckCircle2 className="text-orange-600 h-5 w-5" />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-zinc-500 mb-4">No address found.</p>
                                                <Button variant="outline" onClick={() => setIsAddingAddress(true)}>
                                                    Add New Address
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Personal Info */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <UserIcon className="text-orange-600 h-5 w-5" />
                                    Personal Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">First Name</label>
                                    <div className="text-zinc-900 font-medium">{user.firstName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Last Name</label>
                                    <div className="text-zinc-900 font-medium">{user.lastName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Email</label>
                                    <div className="text-zinc-900 font-medium">{user.email}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Phone</label>
                                    <div className="text-zinc-900 font-medium">{user.phoneNumber || '-'}</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Coupon & Wallet Section */}
                        <div className="grid gap-6 sm:grid-cols-2">
                            {/* Coupon Card */}
                            <Card className="border-zinc-200 shadow-sm overflow-hidden">
                                <CardHeader className="pb-3 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Ticket className="text-orange-600 h-5 w-5" />
                                        Promotions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {selectedCart?.appliedPromotion ? (
                                        <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                            <div className="flex items-center gap-2">
                                                <Ticket size={16} />
                                                <div>
                                                    <p className="font-bold text-sm">{selectedCart.appliedPromotion.name}</p>
                                                    <p className="text-xs">{selectedCart.appliedPromotion.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRemoveCoupon}
                                                disabled={isCouponLoading}
                                                className="text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 p-1.5 rounded-full transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <button
                                                onClick={() => setShowCouponModal(true)}
                                                className="w-full text-center text-orange-600 text-sm hover:underline"
                                            >
                                                View Available Coupons
                                            </button>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value)}
                                                    placeholder="Enter coupon code"
                                                    className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 uppercase placeholder:normal-case"
                                                />
                                                <button
                                                    onClick={handleApplyCoupon}
                                                    disabled={!couponCode.trim() || isCouponLoading}
                                                    className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Wallet Card */}
                            <Card className="border-zinc-200 shadow-sm overflow-hidden">
                                <CardHeader className="pb-3 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Wallet className="text-orange-600 h-5 w-5" />
                                        Wallet
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-zinc-600 text-sm">Available Balance</span>
                                        <span className="font-bold text-zinc-800">
                                            {walletBalance?.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </span>
                                    </div>

                                    {walletAppliedAmount > 0 ? (
                                        <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                            <span className="font-medium text-sm">Used: {walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                            <button
                                                onClick={handleRemoveWallet}
                                                className="text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 p-1.5 rounded-full transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={walletAmountInput}
                                                onChange={(e) => setWalletAmountInput(e.target.value)}
                                                placeholder="Amount to use"
                                                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <button
                                                onClick={() => handleApplyWallet()}
                                                disabled={!walletBalance || walletBalance.balance <= 0 || !walletAmountInput}
                                                className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={handleUseMaxWallet}
                                                disabled={!walletBalance || walletBalance.balance <= 0}
                                                className="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                            >
                                                Use All
                                            </button>
                                        </div>
                                    )}

                                    {walletAppliedAmount > 0 && (
                                        <p className="text-xs text-green-600 mt-2 text-right">
                                            -{walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL applied
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                    </div>

                    {/* Order Summary */}
                    <div className="md:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            <Card className="border-zinc-200 shadow-sm overflow-hidden">
                                <CardHeader className="bg-zinc-50 border-b border-zinc-100 py-4">
                                    <CardTitle className="text-lg">Your Order</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[300px] overflow-y-auto p-4 space-y-4">
                                        {items.map(item => (
                                            <div key={item.id} className="flex gap-3">
                                                <div className="h-12 w-12 bg-zinc-50 rounded-lg relative overflow-hidden shrink-0">
                                                    {item.imgUrl && <Image src={item.imgUrl} alt={item.productName || ''} fill className="object-cover" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-medium text-zinc-900 line-clamp-2">{item.productName}</h4>
                                                        <span className="text-xs font-semibold text-zinc-900">₺{item.price}</span>
                                                    </div>
                                                    <div className="text-xs text-zinc-500 mt-1">x {item.qty}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-zinc-50 border-t border-zinc-100 space-y-2 text-sm">
                                        <div className="flex justify-between text-zinc-600">
                                            <span>Subtotal</span>
                                            <span>₺{subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-zinc-600">
                                            <span>Delivery Fee</span>
                                            <span className="text-green-600">Free</span>
                                        </div>

                                        {selectedCart?.discountAmount && selectedCart.discountAmount > 0 ? (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <div className="flex items-center gap-1">
                                                    <Ticket size={14} />
                                                    <span>Discount</span>
                                                </div>
                                                <span>-₺{selectedCart.discountAmount.toFixed(2)}</span>
                                            </div>
                                        ) : null}

                                        {walletAppliedAmount > 0 ? (
                                            <div className="flex justify-between text-sm text-orange-600">
                                                <div className="flex items-center gap-1">
                                                    <Wallet size={14} />
                                                    <span>Wallet Used</span>
                                                </div>
                                                <span>-₺{walletAppliedAmount.toFixed(2)}</span>
                                            </div>
                                        ) : null}

                                        <div className="flex justify-between text-zinc-900 font-bold pt-2 border-t border-zinc-200 mt-2 text-base">
                                            <span>Total</span>
                                            <span className="text-orange-600">₺{finalTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
                <div className="container mx-auto max-w-4xl flex items-center justify-between gap-4">
                    <div className="hidden sm:block">
                        <div className="text-sm text-zinc-500">Total to Pay</div>
                        <div className="text-xl font-bold text-orange-600">₺{finalTotal.toFixed(2)}</div>
                    </div>

                    <Button
                        size="lg"
                        className="w-full sm:w-auto min-w-[200px] bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
                        disabled={!selectedAddressId || isProcessing || isAddingAddress}
                        onClick={handleCompleteOrder}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Complete Order'
                        )}
                    </Button>
                </div>
            </div>

            {/* Coupon List Modal */}
            {showCouponModal && (
                <CouponListModal
                    onClose={() => setShowCouponModal(false)}
                    onApply={handleApplySpecificCoupon}
                    availablePromotions={availablePromotions}
                    checkAvailablePromotions={checkAvailablePromotions}
                />
            )}
        </div>
    );
}

function CouponListModal({ onClose, onApply, availablePromotions, checkAvailablePromotions }: {
    onClose: () => void;
    onApply: (code: string) => void;
    availablePromotions: any[];
    checkAvailablePromotions: () => Promise<void>;
}) {
    useEffect(() => {
        checkAvailablePromotions();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-lg">Available Coupons</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {availablePromotions.length === 0 ? (
                        <p className="text-center text-zinc-500 py-4">No available coupons found.</p>
                    ) : (
                        <div className="space-y-3">
                            {availablePromotions.map((item: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-lg border ${item.applicable ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-zinc-50 opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-zinc-800">{item.promotion.name}</h4>
                                        {item.applicable && (
                                            <button
                                                onClick={() => onApply(item.promotion.couponCode)}
                                                className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700"
                                            >
                                                Apply
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-600 mb-2">{item.promotion.description}</p>
                                    {!item.applicable && (
                                        <p className="text-xs text-red-500">
                                            {item.unapplicableReason === 'ALREADY_USED'
                                                ? 'This coupon has already been used'
                                                : item.unapplicableReason}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
