'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { AlertCircle, Banknote, CheckCircle2, CreditCard, Edit2, Loader2, MapPin, MessageSquareText, Plus, Ticket, User as UserIcon, Wallet, X, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { paymentService, type PaymentMethod } from '@/services/payment.service';
import { userService } from '@/services/user.service';
import { walletService, WalletBalance } from '@/services/wallet.service';
import { branchService } from '@/services/branch.service';
import { AxiosError } from 'axios';
import { AddressForm, AddressFormValues } from '@/components/address/AddressForm';
import { CartPromotions } from '@/components/cart/CartPromotions';
import type { Address } from '@/types/address';
import type { Branch } from '@/types/branch';
import { getCartId, type Cart, type CartItem } from '@/types/cart';
import { sanitizePositiveNumber } from '@/lib/utils';
import { isLoyaltyError, resolveLoyaltyErrorMessage } from '@/lib/loyalty-errors';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type ApiErrorBody = {
    message?: string | string[];
    statusCode?: number;
    error?: string;
};

const PAYMENT_METHOD_OPTIONS: Array<{
    value: PaymentMethod;
    labelKey: string;
    descriptionKey: string;
    Icon: LucideIcon;
}> = [
    {
        value: 'ONLINE_CARD',
        labelKey: 'checkout.payment.onlineCard',
        descriptionKey: 'checkout.payment.onlineCardDesc',
        Icon: CreditCard,
    },
    {
        value: 'CASH',
        labelKey: 'checkout.payment.cash',
        descriptionKey: 'checkout.payment.cashDesc',
        Icon: Banknote,
    },
    {
        value: 'CARD_ON_DELIVERY',
        labelKey: 'checkout.payment.cardOnDelivery',
        descriptionKey: 'checkout.payment.cardOnDeliveryDesc',
        Icon: CreditCard,
    },
];

type CartWithBranchVariants = Cart & {
    branch?: { id?: string | null } | null;
    branch_id?: string | null;
};

type BranchWithIdVariants = Branch & {
    branchId?: string | null;
    branch_id?: string | null;
};

const getCartBranchId = (cart: Cart | undefined, selectedBranchId?: string) => {
    const cartWithBranch = cart as CartWithBranchVariants | undefined;

    return cartWithBranch?.branchId
        || cartWithBranch?.branch_id
        || cartWithBranch?.branch?.id
        || selectedBranchId
        || '';
};

const getBranchIdentity = (branch: Branch) => {
    const branchWithVariants = branch as BranchWithIdVariants;
    return branchWithVariants.id || branchWithVariants.branchId || branchWithVariants.branch_id || '';
};

const toFiniteNumber = (value: number | string | null | undefined) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

const isBranchServingLocation = async (
    targetBranchId: string,
    latitudeValue: number | string | null | undefined,
    longitudeValue: number | string | null | undefined,
) => {
    if (!targetBranchId) {
        return true;
    }

    const latitude = toFiniteNumber(latitudeValue);
    const longitude = toFiniteNumber(longitudeValue);

    if (latitude === null || longitude === null) {
        return false;
    }

    const nearbyBranches = await branchService.getNearbyBranches(latitude, longitude);
    return nearbyBranches.some((branch) => getBranchIdentity(branch) === targetBranchId);
};

const formatPriceDelta = (price?: number | null) => {
    if (!price) {
        return '';
    }

    return ` (+₺${price.toFixed(2)})`;
};

const getCartItemDetailLines = (item: CartItem) => {
    const optionLines = (item.options || []).flatMap((group) =>
        group.selections.map((selection) =>
            `${group.groupName}: ${selection.optionName}${formatPriceDelta(selection.priceDelta)}`,
        ),
    );

    const addonLines = (item.addons || []).map((addon) =>
        `${addon.name}${formatPriceDelta(addon.price)}`,
    );

    const noteLine = item.note?.trim() ? [`Note: ${item.note.trim()}`] : [];

    return [...optionLines, ...addonLines, ...noteLine];
};

const getApiErrorMessage = (error: unknown, t: TFunction) => {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const message = axiosError.response?.data?.message;

    if (Array.isArray(message)) {
        return message.join(' ');
    }

    return message || t('checkout.toast.failedOrder');
};

const messageIncludesPhone = (lowerMessage: string) =>
    lowerMessage.includes('phone') || lowerMessage.includes('telefon');

const getCheckoutErrorHelp = (message: string, t: TFunction) => {
    const lowerMessage = message.toLowerCase();

    if (messageIncludesPhone(lowerMessage)) {
        return t('checkout.errorHelp.phone');
    }

    if (lowerMessage.includes('deliver to your current address') || lowerMessage.includes('mevcut adres')) {
        return t('checkout.errorHelp.currentAddress');
    }

    if (lowerMessage.includes('served by this branch') || lowerMessage.includes('hizmet')) {
        return t('checkout.errorHelp.served');
    }

    return null;
};



export default function CheckoutView() {
    const { t } = useTranslation();
    const { user, addresses, refreshAddresses } = useUser();
    const {
        carts,
        isCartOpen,
        closeCart,
        refreshSingleCart,
        invalidateAvailablePromotions,
    } = useCart();
    const { selectedBranch } = useBranch();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('ONLINE_CARD');
    const [orderNote, setOrderNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [deliveryError, setDeliveryError] = useState<string | null>(null);
    const [deliverableAddressIds, setDeliverableAddressIds] = useState<Set<string>>(new Set());
    const [isCheckingAddresses, setIsCheckingAddresses] = useState(false);

    /** Set when checkout validation reports a promotion change; blocks ordering until re-confirmed. */
    const [needsTotalReconfirm, setNeedsTotalReconfirm] = useState(false);

    // Wallet states
    const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
    const [walletAmountInput, setWalletAmountInput] = useState('');
    const [walletAppliedAmount, setWalletAppliedAmount] = useState(0);

    // Determine which cart to show
    const cartIdParam = searchParams.get('cartId');
    const selectedCart = cartIdParam
        ? carts.find(c => (c.cartId || c.id) === cartIdParam)
        : carts.find(c => c.items && c.items.length > 0);
    const selectedCartId = getCartId(selectedCart);
    const targetBranchId = getCartBranchId(selectedCart, selectedBranch?.id);
    const deliverableAddresses = useMemo(
        () => addresses.filter((address) => deliverableAddressIds.has(address.id)),
        [addresses, deliverableAddressIds],
    );

    useEffect(() => {
        if (isCartOpen) {
            closeCart();
        }
    }, [isCartOpen, closeCart]);

    useEffect(() => {
        let isCurrent = true;

        const checkDeliverableAddresses = async () => {
            if (!targetBranchId || addresses.length === 0) {
                if (isCurrent) {
                    setDeliverableAddressIds(targetBranchId ? new Set() : new Set(addresses.map((address) => address.id)));
                    setIsCheckingAddresses(false);
                }
                return;
            }

            setIsCheckingAddresses(true);

            try {
                const results = await Promise.all(
                    addresses.map(async (address) => {
                        try {
                            const isServed = await isBranchServingLocation(targetBranchId, address.latitude, address.longitude);
                            return [address.id, isServed] as const;
                        } catch (error) {
                            console.error(`Failed to check delivery coverage for address ${address.id}`, error);
                            return [address.id, false] as const;
                        }
                    }),
                );

                if (!isCurrent) return;

                setDeliverableAddressIds(
                    new Set(results.filter(([, isDeliverable]) => isDeliverable).map(([addressId]) => addressId)),
                );
            } finally {
                if (isCurrent) {
                    setIsCheckingAddresses(false);
                }
            }
        };

        checkDeliverableAddresses();

        return () => {
            isCurrent = false;
        };
    }, [addresses, targetBranchId]);

    useEffect(() => {
        if (isCheckingAddresses) {
            return;
        }

        const timer = setTimeout(() => {
            if (deliverableAddresses.length === 0) {
                if (selectedAddressId) {
                    setSelectedAddressId('');
                }
                return;
            }

            const selectedIsDeliverable = deliverableAddresses.some((address) => address.id === selectedAddressId);
            if (selectedIsDeliverable) {
                return;
            }

            const active = deliverableAddresses.find((address) => address.isActive);
            setSelectedAddressId((active || deliverableAddresses[0]).id);
        }, 0);

        return () => clearTimeout(timer);
    }, [deliverableAddresses, isCheckingAddresses, selectedAddressId]);

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
        return <div className="p-8 text-center">{t('checkout.loginRequired')}</div>;
    }

    if (!selectedCart || !selectedCart.items || selectedCart.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h1 className="text-2xl font-bold text-zinc-900">{t('checkout.emptyCart')}</h1>
                <Button onClick={() => router.push('/')}>{t('checkout.goHome')}</Button>
            </div>
        );
    }

    const items = selectedCart.items;
    const subtotal = selectedCart.totalCartPrice || 0;
    const finalTotal = Math.max(0, (selectedCart.finalPrice ?? selectedCart.totalCartPrice ?? subtotal) - walletAppliedAmount);
    const selectedAddress = deliverableAddresses.find(a => a.id === selectedAddressId);
    const selectedAddressHasPhone = Boolean(selectedAddress?.phoneE164?.trim());
    const editingAddress = editingAddressId ? addresses.find(a => a.id === editingAddressId) : undefined;
    const deliveryErrorHelp = deliveryError ? getCheckoutErrorHelp(deliveryError, t) : null;
    const deliveryErrorTitle = deliveryError && messageIncludesPhone(deliveryError.toLowerCase())
        ? t('checkout.errorTitle.phone')
        : t('checkout.errorTitle.generic');
    const branchUnavailableMessage = t('checkout.toast.branchUnavailable');

    // --- Wallet Handlers ---
    const handleApplyWallet = (amountOverride?: number) => {
        if (!walletBalance) return;

        let amount = amountOverride;
        if (amount === undefined) {
            if (!walletAmountInput) return;
            amount = parseFloat(walletAmountInput);
        }

        if (isNaN(amount) || amount <= 0) {
            toast.error(t('checkout.toast.validAmount'));
            return;
        }

        if (amount > walletBalance.balance) {
            toast.error(t('checkout.toast.exceedBalance'));
            return;
        }

        const totalToPay = selectedCart?.finalPrice ?? selectedCart?.totalCartPrice ?? 0;
        if (amount > totalToPay) {
            amount = totalToPay;
        }

        setWalletAppliedAmount(amount);
        setWalletAmountInput('');
        toast.success(t('checkout.toast.walletApplied'));
    };

    const handleUseMaxWallet = () => {
        if (!walletBalance || !selectedCart) return;
        const totalToPay = selectedCart.finalPrice ?? selectedCart.totalCartPrice ?? 0;
        const maxAmount = Math.min(walletBalance.balance, totalToPay);
        handleApplyWallet(maxAmount);
    };

    const handleRemoveWallet = () => {
        setWalletAppliedAmount(0);
        toast.success(t('checkout.toast.walletRemoved'));
    };

    // --- Checkout Handler ---
    const handleCompleteOrder = async () => {
        if (!selectedCart) {
            toast.error(t('checkout.toast.noCart'));
            return;
        }

        setDeliveryError(null);

        try {
            setIsProcessing(true);

            if (needsTotalReconfirm) {
                toast.error(t('checkout.promotionsChanged.description'));
                return;
            }

            if (isCheckingAddresses) {
                const msg = t('checkout.toast.checkingAvailability');
                setDeliveryError(msg);
                toast.error(msg);
                return;
            }

            if (!selectedAddress) {
                const msg = t('checkout.toast.selectServedAddress');
                setDeliveryError(msg);
                toast.error(msg);
                return;
            }

            if (!selectedAddress.phoneE164) {
                const msg = t('checkout.toast.phoneRequiredOrder');
                setDeliveryError(msg);
                toast.error(msg);
                return;
            }

            if (!selectedAddress.isActive) {
                await userService.updateAddress(selectedAddressId, { isActive: true });
            }

            const cartId = selectedCart.cartId || selectedCart.id || '';
            const paymentResponse = await paymentService.initializePayment(
                cartId,
                selectedPaymentMethod,
                'DELIVERY',
                walletAppliedAmount > 0 ? walletAppliedAmount : undefined,
                orderNote
            );

            if (paymentResponse.paymentUrl) {
                window.location.href = paymentResponse.paymentUrl;
            } else if (paymentResponse.checkoutFormContent) {
                document.write(paymentResponse.checkoutFormContent);
            } else {
                toast.success(t('checkout.toast.orderPlaced'));
                router.push('/profile?tab=orders');
                closeCart();
            }

        } catch (error) {
            console.error('Order/Payment Error:', error);

            // Checkout re-validates promotions; if they changed, resync and ask the
            // user to confirm the new total before we retry the payment.
            if (isLoyaltyError(error)) {
                toast.error(resolveLoyaltyErrorMessage(error, t, 'cart.loyalty.toast.applyFailed'));
                setNeedsTotalReconfirm(true);
                await refreshSingleCart(selectedCartId);
                invalidateAvailablePromotions();
                return;
            }

            const msg = getApiErrorMessage(error, t);
            setDeliveryError(msg);
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const resolveNewAddressIsActive = async (data: AddressFormValues) => {
        const isServed = await isBranchServingLocation(targetBranchId, data.latitude, data.longitude);
        if (!isServed) {
            setDeliveryError(branchUnavailableMessage);
        }
        return isServed;
    };

    const handleAddressSuccess = async (address?: Address) => {
        await refreshAddresses();
        setIsAddingAddress(false);
        if (address && !address.isActive) {
            setSelectedAddressId('');
            setDeliveryError(branchUnavailableMessage);
            toast.error(branchUnavailableMessage);
            return;
        }

        if (address?.id) {
            setSelectedAddressId(address.id);
        }
        setDeliveryError(null);
    };

    const handleAddressEditSuccess = async () => {
        const editedAddressId = editingAddressId;

        await refreshAddresses();
        if (editedAddressId) {
            setSelectedAddressId(editedAddressId);
        }
        setEditingAddressId(null);
        setDeliveryError(null);
    };

    return (
        <div className="min-h-screen bg-zinc-50 py-8 pb-32">
            <div className="container mx-auto px-4 max-w-6xl">
                <h1 className="text-3xl font-bold text-zinc-900 mb-8">{t('checkout.title')}</h1>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">

                        {/* Delivery Address */}
                        <Card className={`border-zinc-200 shadow-sm ${deliveryError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <CardTitle className="flex items-center justify-between text-lg">
                                    <div className="flex items-center gap-2">
                                        <MapPin className={`h-5 w-5 ${deliveryError ? 'text-red-500' : 'text-orange-600'}`} />
                                        <span className={deliveryError ? 'text-red-600' : ''}>{t('checkout.deliveryAddress')}</span>
                                    </div>
                                    {!isAddingAddress && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => { setIsAddingAddress(true); setDeliveryError(null); }}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> {t('checkout.addNew')}
                                        </Button>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {deliveryError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div>
                                            <p className="font-semibold">{deliveryErrorTitle}</p>
                                            <p>{deliveryError}</p>
                                            {deliveryErrorHelp && <p className="mt-1">{deliveryErrorHelp}</p>}
                                            {selectedAddress && (
                                                <button
                                                    type="button"
                                                    className="mt-2 text-sm font-semibold text-red-700 underline-offset-4 hover:underline"
                                                    onClick={() => setEditingAddressId(selectedAddressId)}
                                                >
                                                    {t('checkout.editSelectedAddress')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isAddingAddress ? (
                                    <AddressForm
                                        onCancel={() => setIsAddingAddress(false)}
                                        onSuccess={handleAddressSuccess}
                                        resolveCreateIsActive={resolveNewAddressIsActive}
                                    />
                                ) : (
                                    <>
                                        {isCheckingAddresses ? (
                                            <div className="py-4 text-sm text-zinc-500">{t('checkout.checkingAddresses')}</div>
                                        ) : deliverableAddresses.length > 0 ? (
                                            <div className="space-y-4">
                                                {deliverableAddresses.map(addr => (
                                                    <div
                                                        key={addr.id}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr.id
                                                                ? 'border-orange-600 bg-orange-50/50'
                                                                : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                                                            }`}
                                                        onClick={() => setSelectedAddressId(addr.id)}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-zinc-900">{addr.province}, {addr.district}</div>
                                                                <div className="text-sm text-zinc-500 mt-1">{addr.street} No: {addr.buildingNumber}</div>
                                                                <div className={`text-xs mt-2 ${addr.phoneE164 ? 'text-zinc-500' : 'text-red-600'}`}>
                                                                    {addr.phoneE164 || t('checkout.phoneMissing')}
                                                                </div>
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('checkout.editAddressAria')}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white hover:text-orange-600"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setEditingAddressId(addr.id);
                                                                        setDeliveryError(null);
                                                                    }}
                                                                >
                                                                    <Edit2 className="h-4 w-4" />
                                                                </button>
                                                                {selectedAddressId === addr.id && (
                                                                    <CheckCircle2 className="text-orange-600 h-5 w-5" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-zinc-500 mb-4">
                                                    {addresses.length > 0
                                                        ? t('checkout.noServedAddress')
                                                        : t('checkout.noAddress')}
                                                </p>
                                                <Button variant="outline" onClick={() => setIsAddingAddress(true)}>
                                                    {t('checkout.addNewAddress')}
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
                                    {t('checkout.personalInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">{t('checkout.firstName')}</label>
                                    <div className="text-zinc-900 font-medium">{user.firstName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">{t('checkout.lastName')}</label>
                                    <div className="text-zinc-900 font-medium">{user.lastName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">{t('checkout.email')}</label>
                                    <div className="text-zinc-900 font-medium">{user.email}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-500 uppercase">{t('checkout.phone')}</label>
                                    <div className="text-zinc-900 font-medium">{user.phoneNumber || '-'}</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment Method */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <CreditCard className="text-orange-600 h-5 w-5" />
                                    {t('checkout.paymentMethod')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {PAYMENT_METHOD_OPTIONS.map(({ value, labelKey, descriptionKey, Icon }) => {
                                        const isSelected = selectedPaymentMethod === value;

                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setSelectedPaymentMethod(value)}
                                                className={`flex min-h-24 flex-col items-start justify-between rounded-lg border-2 p-4 text-left transition-colors ${isSelected
                                                        ? 'border-orange-600 bg-orange-50/60 text-orange-700'
                                                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-orange-200 hover:bg-orange-50/40'
                                                    }`}
                                            >
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <Icon className={`h-5 w-5 ${isSelected ? 'text-orange-600' : 'text-zinc-500'}`} />
                                                    <span className={`h-4 w-4 rounded-full border ${isSelected ? 'border-orange-600 bg-orange-600 shadow-[inset_0_0_0_3px_white]' : 'border-zinc-300'}`} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-900">{t(labelKey)}</div>
                                                    <div className="mt-1 text-xs leading-snug text-zinc-500">{t(descriptionKey)}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Note */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <MessageSquareText className="text-orange-600 h-5 w-5" />
                                    {t('checkout.orderNote')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <textarea
                                    value={orderNote}
                                    onChange={(event) => setOrderNote(event.target.value)}
                                    maxLength={1000}
                                    rows={4}
                                    placeholder={t('checkout.orderNotePlaceholder')}
                                    className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </CardContent>
                        </Card>

                        {/* Promotions & Wallet Section */}
                        <div className="grid gap-6 sm:grid-cols-2">
                            {/* Promotions Card — internal coupons and Rekonect campaigns in one list */}
                            {selectedCartId && (
                                <Card className="border-zinc-200 shadow-sm overflow-hidden">
                                    <CardHeader className="pb-3 border-b border-zinc-100">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Ticket className="text-orange-600 h-5 w-5" />
                                            {t('checkout.promotions')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <CartPromotions
                                            cartId={selectedCartId}
                                            appliedPromotions={selectedCart.appliedPromotions}
                                            allowCouponCode
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Wallet Card */}
                            <Card className="border-zinc-200 shadow-sm overflow-hidden h-full flex flex-col">
                                <CardHeader className="pb-3 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Wallet className="text-orange-600 h-5 w-5" />
                                        {t('checkout.wallet')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-4">
                                    <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-3">
                                        <span className="text-xs font-medium uppercase text-orange-700">{t('checkout.availableBalance')}</span>
                                        <div className="mt-1 text-2xl font-bold leading-none text-zinc-900">
                                            ₺{walletBalance?.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {walletAppliedAmount > 0 ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                                <span className="font-medium text-sm">{t('checkout.used')}: ₺{walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                                <button
                                                    onClick={handleRemoveWallet}
                                                    className="text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 p-1.5 rounded-full transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-green-600 text-right">
                                                -₺{walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {t('checkout.applied')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    inputMode="decimal"
                                                    value={walletAmountInput}
                                                    onChange={(e) => setWalletAmountInput(sanitizePositiveNumber(e.target.value, walletAmountInput))}
                                                    placeholder={t('checkout.amountToUse')}
                                                    className="min-w-0 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <button
                                                    onClick={() => handleApplyWallet()}
                                                    disabled={!walletBalance || walletBalance.balance <= 0 || !walletAmountInput}
                                                    className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {t('checkout.apply')}
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleUseMaxWallet}
                                                disabled={!walletBalance || walletBalance.balance <= 0}
                                                className="w-full bg-white text-orange-600 border border-orange-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {t('checkout.useAllBalance')}
                                            </button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                    </div>

                    {/* Order Summary */}
                    <div>
                        <div className="sticky top-24 space-y-6">
                            <Card className="border-zinc-200 shadow-sm overflow-hidden">
                                <CardHeader className="bg-zinc-50 border-b border-zinc-100 py-4">
                                    <CardTitle className="text-lg">{t('checkout.yourOrder')}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[300px] overflow-y-auto p-4 space-y-4">
                                        {items.map(item => {
                                            const detailLines = getCartItemDetailLines(item);

                                            return (
                                                <div key={item.id} className="flex gap-3">
                                                    <div className="h-12 w-12 bg-zinc-50 rounded-lg relative overflow-hidden shrink-0">
                                                        {item.imgUrl && <Image src={item.imgUrl} alt={item.productName || ''} fill className="object-cover" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <h4 className="text-sm font-medium text-zinc-900 line-clamp-2">{item.productName}</h4>
                                                            <span className="shrink-0 text-xs font-semibold text-zinc-900">₺{item.price}</span>
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-1">x {item.qty}</div>
                                                        {detailLines.length > 0 && (
                                                            <div className="mt-1 space-y-0.5">
                                                                {detailLines.map((line, index) => (
                                                                    <p key={`${item.id}-detail-${index}`} className="break-words text-xs leading-snug text-zinc-500">
                                                                        {line}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {targetBranchId && (
                                        <div className="px-4 pb-4">
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/branches/${targetBranchId}`)}
                                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                                            >
                                                <Plus className="h-4 w-4" />
                                                {t('checkout.addMoreItems')}
                                            </button>
                                        </div>
                                    )}
                                    <div className="p-4 bg-zinc-50 border-t border-zinc-100 space-y-2 text-sm">
                                        <div className="flex justify-between text-zinc-600">
                                            <span>{t('checkout.subtotal')}</span>
                                            <span>₺{subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-zinc-600">
                                            <span>{t('checkout.deliveryFee')}</span>
                                            <span className="text-green-600">{t('checkout.free')}</span>
                                        </div>

                                        {selectedCart?.discountAmount && selectedCart.discountAmount > 0 ? (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <div className="flex items-center gap-1">
                                                    <Ticket size={14} />
                                                    <span>{t('checkout.discount')}</span>
                                                </div>
                                                <span>-₺{selectedCart.discountAmount.toFixed(2)}</span>
                                            </div>
                                        ) : null}

                                        {walletAppliedAmount > 0 ? (
                                            <div className="flex justify-between text-sm text-orange-600">
                                                <div className="flex items-center gap-1">
                                                    <Wallet size={14} />
                                                    <span>{t('checkout.walletUsed')}</span>
                                                </div>
                                                <span>-₺{walletAppliedAmount.toFixed(2)}</span>
                                            </div>
                                        ) : null}

                                        <div className="flex justify-between text-zinc-900 font-bold pt-2 border-t border-zinc-200 mt-2 text-base">
                                            <span>{t('checkout.total')}</span>
                                            <span className="text-orange-600">₺{finalTotal.toFixed(2)}</span>
                                        </div>

                                        {needsTotalReconfirm && (
                                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                                                <p className="flex items-start gap-2 text-sm font-semibold">
                                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                    {t('checkout.promotionsChanged.title')}
                                                </p>
                                                <p className="mt-1 text-xs leading-snug">
                                                    {t('checkout.promotionsChanged.description')}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setNeedsTotalReconfirm(false)}
                                                    className="mt-2 text-sm font-semibold text-amber-900 underline-offset-4 hover:underline"
                                                >
                                                    {t('checkout.promotionsChanged.confirm')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
                <div className="container mx-auto max-w-6xl flex items-center justify-between gap-4">
                    <div className="hidden sm:block">
                        <div className="text-sm text-zinc-500">{t('checkout.totalToPay')}</div>
                        <div className="text-xl font-bold text-orange-600">₺{finalTotal.toFixed(2)}</div>
                    </div>

                    <Button
                        size="lg"
                        className="w-full sm:w-auto min-w-[200px] bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
                        disabled={!selectedAddress || !selectedAddressHasPhone || isCheckingAddresses || isProcessing || isAddingAddress || needsTotalReconfirm}
                        onClick={handleCompleteOrder}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('checkout.processing')}
                            </>
                        ) : (
                            t('checkout.completeOrder')
                        )}
                    </Button>
                </div>
            </div>

            {editingAddressId && editingAddress && (
                <AddressEditModal
                    address={editingAddress}
                    onClose={() => setEditingAddressId(null)}
                    onSuccess={handleAddressEditSuccess}
                />
            )}
        </div>
    );
}

function AddressEditModal({ address, onClose, onSuccess }: {
    address: Address;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white p-4">
                    <h3 className="text-lg font-bold text-zinc-900">{t('checkout.editAddress')}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <AddressForm
                        initialValues={{ ...address, phoneE164: address.phoneE164 ?? '' }}
                        addressId={address.id}
                        onCancel={onClose}
                        onSuccess={onSuccess}
                    />
                </div>
            </div>
        </div>
    );
}

