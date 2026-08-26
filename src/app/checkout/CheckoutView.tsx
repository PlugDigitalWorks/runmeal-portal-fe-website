'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { AlertCircle, Banknote, CalendarClock, CheckCircle2, CreditCard, Edit2, Loader2, MapPin, MessageSquareText, Plus, Store, Ticket, Truck, User as UserIcon, Wallet, X, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { paymentService, type OrderType, type PaymentMethod } from '@/services/payment.service';
import { userService } from '@/services/user.service';
import { walletService, WalletBalance } from '@/services/wallet.service';
import { branchService } from '@/services/branch.service';
import { AddressForm, AddressFormValues } from '@/components/address/AddressForm';
import { CartPromotions } from '@/components/cart/CartPromotions';
import { FulfillmentSlotPicker } from '@/components/checkout/FulfillmentSlotPicker';
import type { Address } from '@/types/address';
import {
    resolveOrderTypeSettings,
    resolvePaymentSettings,
    type Branch,
    type ScheduledOrderType,
} from '@/types/branch';
import { cartService } from '@/services/cart.service';
import { getCartId, type Cart, type CartItem, type CartLoyaltyWallet } from '@/types/cart';
import { formatCurrencyAmount, resolveCurrencySymbol } from '@/lib/currency';
import { sanitizePositiveNumber } from '@/lib/utils';
import {
    getApiErrorCode,
    isLoyaltyError,
    isProductRewardCheckoutError,
    resolveLoyaltyErrorMessage,
} from '@/lib/loyalty-errors';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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

const ORDER_TYPE_OPTIONS: Array<{
    value: OrderType;
    labelKey: string;
    /** Which `order_type_settings` flag turns this option on. */
    settingKey: 'delivery' | 'pickup' | 'scheduledDelivery' | 'scheduledPickup';
    /** Assumed when the branch payload predates `order_type_settings`. */
    defaultActive: boolean;
    Icon: LucideIcon;
}> = [
    { value: 'DELIVERY', labelKey: 'checkout.orderTypes.delivery', settingKey: 'delivery', defaultActive: true, Icon: Truck },
    { value: 'PICKUP', labelKey: 'checkout.orderTypes.pickup', settingKey: 'pickup', defaultActive: false, Icon: Store },
    { value: 'SCHEDULED_DELIVERY', labelKey: 'checkout.orderTypes.scheduledDelivery', settingKey: 'scheduledDelivery', defaultActive: false, Icon: CalendarClock },
    { value: 'SCHEDULED_PICKUP', labelKey: 'checkout.orderTypes.scheduledPickup', settingKey: 'scheduledPickup', defaultActive: false, Icon: CalendarClock },
];

const isPickupOrderType = (orderType: OrderType) =>
    orderType === 'PICKUP' || orderType === 'SCHEDULED_PICKUP';

const isScheduledOrderType = (orderType: OrderType) =>
    orderType === 'SCHEDULED_DELIVERY' || orderType === 'SCHEDULED_PICKUP';

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

const messageIncludesPhone = (lowerMessage: string) =>
    lowerMessage.includes('phone') || lowerMessage.includes('telefon');

/** The extra line under an API failure, keyed by the error code it came with. */
const CHECKOUT_ERROR_HELP_BY_CODE: Record<string, string> = {
    PAYMENT_PHONE_REQUIRED: 'checkout.errorHelp.phone',
    PAYMENT_ADDRESS_OUT_OF_DELIVERY_RANGE: 'checkout.errorHelp.currentAddress',
    PAYMENT_ADDRESS_REQUIRED: 'checkout.errorHelp.served',
    USER_ACTIVE_ADDRESS_LOCATION_MISSING: 'checkout.errorHelp.served',
};

const getCheckoutErrorHelp = (code: string | null, message: string, t: TFunction) => {
    const helpKey = code ? CHECKOUT_ERROR_HELP_BY_CODE[code] : undefined;
    if (helpKey) return t(helpKey);

    // Pre-flight failures we raise ourselves carry no API code, so those keep
    // being recognised by their own copy.
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
        setPromotionOrderType,
    } = useCart();
    const { selectedBranch } = useBranch();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('ONLINE_CARD');
    const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
    const [scheduledFor, setScheduledFor] = useState<string | null>(null);
    const [slotRefreshKey, setSlotRefreshKey] = useState(0);
    const [slotStatus, setSlotStatus] = useState({ isLoading: false, hasSlots: false });
    /**
     * The provider's 3DS form, rendered in place. It replaces the checkout view
     * rather than the whole document — `document.write` would tear down React
     * and leave no way back from a failed payment.
     */
    const [checkoutFormHtml, setCheckoutFormHtml] = useState<string | null>(null);
    /** Branch that owns this cart, for its order type and payment settings. */
    const [branchSettings, setBranchSettings] = useState<Branch | null>(null);
    const [orderNote, setOrderNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [deliveryError, setDeliveryError] = useState<string | null>(null);
    /** The API code behind `deliveryError`, when it came from a request. */
    const [deliveryErrorCode, setDeliveryErrorCode] = useState<string | null>(null);

    /** Single entry point for the inline delivery error, so its code never goes stale. */
    const showDeliveryError = (message: string | null, code: string | null = null) => {
        setDeliveryError(message);
        setDeliveryErrorCode(message ? code : null);
    };
    const [deliverableAddressIds, setDeliverableAddressIds] = useState<Set<string>>(new Set());
    const [isCheckingAddresses, setIsCheckingAddresses] = useState(false);

    /** Set when checkout validation reports a promotion change; blocks ordering until re-confirmed. */
    const [needsTotalReconfirm, setNeedsTotalReconfirm] = useState(false);

    // Wallet states
    const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
    const [loyaltyWallet, setLoyaltyWallet] = useState<CartLoyaltyWallet | null>(null);
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

    // Only the fulfillment types this branch actually offers. A branch payload
    // without `order_type_settings` predates the feature and offers delivery only.
    const orderTypeSettings = resolveOrderTypeSettings(branchSettings);
    const orderTypeOptions = useMemo(
        () => ORDER_TYPE_OPTIONS.filter(
            (option) => orderTypeSettings?.[option.settingKey]?.isActive ?? option.defaultActive,
        ),
        [orderTypeSettings],
    );
    /**
     * The branch published its fulfillment settings and turned everything off.
     * Distinct from "no settings at all", which still means delivery — so the
     * customer is warned rather than silently sent down the delivery path the
     * backend will reject.
     */
    const hasNoActiveOrderType = !!orderTypeSettings && orderTypeOptions.length === 0;
    const isPickup = isPickupOrderType(orderType);
    const isScheduled = isScheduledOrderType(orderType);

    // A branch that takes no card payments still shows cash; one with no
    // settings at all is assumed to be online-card only, as the backend is.
    const paymentSettings = resolvePaymentSettings(branchSettings);
    const paymentMethodOptions = useMemo(() => {
        const isActive: Record<PaymentMethod, boolean> = {
            ONLINE_CARD: paymentSettings ? (paymentSettings.onlineMethods?.card?.isActive ?? false) : true,
            CASH: paymentSettings?.offlineMethods?.cash?.isActive ?? false,
            CARD_ON_DELIVERY: paymentSettings?.offlineMethods?.cardOnDelivery?.isActive ?? false,
        };

        return PAYMENT_METHOD_OPTIONS
            .filter((option) => isActive[option.value])
            // A scheduled pickup is paid up front; the backend rejects anything else.
            .filter((option) => orderType !== 'SCHEDULED_PICKUP' || option.value === 'ONLINE_CARD');
    }, [paymentSettings, orderType]);

    /** A scheduled order cannot be placed until a slot the backend issued is picked. */
    const isScheduleReady = !isScheduled || (!slotStatus.isLoading && slotStatus.hasSlots && Boolean(scheduledFor));

    useEffect(() => {
        if (isCartOpen) {
            closeCart();
        }
    }, [isCartOpen, closeCart]);

    // The cart's branch, not the browsed one: the portal lets a customer hold a
    // cart at one branch while looking at another.
    useEffect(() => {
        if (!targetBranchId) {
            setBranchSettings(null);
            return;
        }

        let isCurrent = true;
        branchService.getBranchDetails(targetBranchId)
            .then((branch) => {
                if (isCurrent) setBranchSettings(branch);
            })
            .catch((error) => {
                // Without settings the view falls back to delivery + online card,
                // which the backend accepts everywhere.
                console.error('Failed to fetch branch settings', error);
                if (isCurrent) setBranchSettings(null);
            });

        return () => {
            isCurrent = false;
        };
    }, [targetBranchId]);

    // Keep the selection inside what the branch offers, both times settings load.
    useEffect(() => {
        if (orderTypeOptions.length === 0) return;
        if (orderTypeOptions.some((option) => option.value === orderType)) return;
        setOrderType(orderTypeOptions[0].value);
    }, [orderType, orderTypeOptions]);

    useEffect(() => {
        if (paymentMethodOptions.length === 0) return;
        if (paymentMethodOptions.some((option) => option.value === selectedPaymentMethod)) return;
        setSelectedPaymentMethod(paymentMethodOptions[0].value);
    }, [paymentMethodOptions, selectedPaymentMethod]);

    // A slot only belongs to the order type it was issued for.
    useEffect(() => {
        if (!isScheduled) setScheduledFor(null);
    }, [isScheduled]);

    // The same campaign can be valid on delivery and not on pickup, so the
    // promotion lists are resolved for whatever is selected here.
    useEffect(() => {
        setPromotionOrderType(orderType);
    }, [orderType, setPromotionOrderType]);

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
            showDeliveryError(null);
        }
    }, [selectedAddressId, deliveryError]);

    // Account-wide Runmeal balance; only the fallback for the amount shown below.
    useEffect(() => {
        if (user) {
            walletService.getBalance()
                .then(setWalletBalance)
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [user]);

    // What this cart's branch actually lets the user spend, per its loyalty provider.
    useEffect(() => {
        if (!user || !selectedCartId) {
            setLoyaltyWallet(null);
            return;
        }

        let isCurrent = true;
        cartService.getLoyaltyWallet(selectedCartId)
            .then(wallet => {
                if (isCurrent) setLoyaltyWallet(wallet);
            })
            .catch(err => {
                // Branches without a provider wallet fall back to the Runmeal balance.
                console.error('Failed to fetch cart loyalty wallet', err);
                if (isCurrent) setLoyaltyWallet(null);
            });

        return () => {
            isCurrent = false;
        };
    }, [user, selectedCartId]);


    if (!user) {
        return <div className="p-8 text-center">{t('checkout.loginRequired')}</div>;
    }

    /**
     * The provider's own 3DS form, mounted in place of the checkout. It carries
     * its own auto-submitting script, so it replaces the view rather than
     * sitting inside it — but React stays mounted, which is what makes coming
     * back from a failed payment possible.
     */
    if (checkoutFormHtml) {
        return (
            <div className="min-h-screen bg-zinc-50 py-8">
                <div className="container mx-auto max-w-2xl px-4">
                    <Card className="border-zinc-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('checkout.redirectingToPayment')}
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: checkoutFormHtml }} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
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
    const deliveryErrorHelp = deliveryError ? getCheckoutErrorHelp(deliveryErrorCode, deliveryError, t) : null;
    const deliveryErrorTitle = deliveryError
        && (deliveryErrorCode === 'PAYMENT_PHONE_REQUIRED' || messageIncludesPhone(deliveryError.toLowerCase()))
        ? t('checkout.errorTitle.phone')
        : t('checkout.errorTitle.generic');
    const branchUnavailableMessage = t('checkout.toast.branchUnavailable');

    const spendableBalance = loyaltyWallet?.balance ?? walletBalance?.balance ?? 0;
    const isBalanceSpendable = (loyaltyWallet?.usable ?? true) && spendableBalance > 0;
    const balanceSymbol = resolveCurrencySymbol(loyaltyWallet?.currency);
    const balanceTypeKey = loyaltyWallet && `cart.loyalty.balanceTypes.${loyaltyWallet.balanceType}`;
    const balanceTypeLabel = balanceTypeKey
        ? (t(balanceTypeKey) === balanceTypeKey ? loyaltyWallet.balanceType : t(balanceTypeKey))
        : null;

    // --- Wallet Handlers ---
    const handleApplyWallet = (amountOverride?: number) => {
        if (!isBalanceSpendable) return;

        let amount = amountOverride;
        if (amount === undefined) {
            if (!walletAmountInput) return;
            amount = parseFloat(walletAmountInput);
        }

        if (isNaN(amount) || amount <= 0) {
            toast.error(t('checkout.toast.validAmount'));
            return;
        }

        if (amount > spendableBalance) {
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
        if (!isBalanceSpendable || !selectedCart) return;
        const totalToPay = selectedCart.finalPrice ?? selectedCart.totalCartPrice ?? 0;
        handleApplyWallet(Math.min(spendableBalance, totalToPay));
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

        showDeliveryError(null);

        try {
            setIsProcessing(true);

            if (needsTotalReconfirm) {
                toast.error(t('checkout.promotionsChanged.description'));
                return;
            }

            if (isScheduled && !isScheduleReady) {
                const msg = t('checkout.toast.selectSlot');
                showDeliveryError(msg);
                toast.error(msg);
                return;
            }

            // A pickup order is collected at the branch, so it needs no address
            // and no delivery coverage check.
            if (!isPickup) {
                if (isCheckingAddresses) {
                    const msg = t('checkout.toast.checkingAvailability');
                    showDeliveryError(msg);
                    toast.error(msg);
                    return;
                }

                if (!selectedAddress) {
                    const msg = t('checkout.toast.selectServedAddress');
                    showDeliveryError(msg);
                    toast.error(msg);
                    return;
                }

                if (!selectedAddress.phoneE164) {
                    const msg = t('checkout.toast.phoneRequiredOrder');
                    showDeliveryError(msg);
                    toast.error(msg);
                    return;
                }

                if (!selectedAddress.isActive) {
                    // The backend clears the flag on every other address; a plain
                    // update would leave two addresses marked active.
                    await userService.setActiveAddress(selectedAddressId);
                    await refreshAddresses();
                }
            }

            const cartId = getCartId(selectedCart);
            const paymentResponse = await paymentService.initializePayment({
                cartId,
                branchId: targetBranchId || null,
                paymentMethod: selectedPaymentMethod,
                orderType,
                ...(isScheduled && scheduledFor ? { scheduledFor } : {}),
                creditUsedAmount: walletAppliedAmount > 0 ? walletAppliedAmount : undefined,
                note: orderNote,
            });

            if (paymentResponse.paymentUrl) {
                window.location.href = paymentResponse.paymentUrl;
            } else if (paymentResponse.checkoutFormContent) {
                // Rendered in place — see `checkoutFormHtml`.
                setCheckoutFormHtml(paymentResponse.checkoutFormContent);
            } else {
                toast.success(t('checkout.toast.orderPlaced'));
                router.push('/profile?tab=orders');
                closeCart();
            }

        } catch (error) {
            console.error('Order/Payment Error:', error);

            const errorCode = getApiErrorCode(error) ?? null;

            // The slot the customer picked went stale between load and checkout;
            // reloading the picker is the only way forward.
            if (errorCode === 'BRANCH_FULFILLMENT_SLOT_INVALID' || errorCode === 'BRANCH_FULFILLMENT_SLOT_UNAVAILABLE') {
                setScheduledFor(null);
                setSlotRefreshKey((key) => key + 1);
                toast.error(t('checkout.toast.staleSlot'));
                return;
            }

            // The reward's reservation expired or another order spent it first.
            // The cart and the campaign list have to be refetched and the reward
            // re-applied by hand — never retried silently.
            if (isProductRewardCheckoutError(errorCode)) {
                toast.error(resolveLoyaltyErrorMessage(error, t, 'cart.loyalty.toast.applyFailed'));
                setNeedsTotalReconfirm(true);
                await refreshSingleCart(selectedCartId);
                invalidateAvailablePromotions();
                return;
            }

            // Checkout re-validates promotions; if they changed, resync and ask the
            // user to confirm the new total before we retry the payment.
            if (isLoyaltyError(error)) {
                toast.error(resolveLoyaltyErrorMessage(error, t, 'cart.loyalty.toast.applyFailed'));
                setNeedsTotalReconfirm(true);
                await refreshSingleCart(selectedCartId);
                invalidateAvailablePromotions();
                return;
            }

            const msg = resolveApiErrorMessage(error, t('checkout.toast.failedOrder'));
            showDeliveryError(msg, errorCode);
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const resolveNewAddressIsActive = async (data: AddressFormValues) => {
        const isServed = await isBranchServingLocation(targetBranchId, data.latitude, data.longitude);
        if (!isServed) {
            showDeliveryError(branchUnavailableMessage);
        }
        return isServed;
    };

    const handleAddressSuccess = async (address?: Address) => {
        await refreshAddresses();
        setIsAddingAddress(false);
        if (address && !address.isActive) {
            setSelectedAddressId('');
            showDeliveryError(branchUnavailableMessage);
            toast.error(branchUnavailableMessage);
            return;
        }

        if (address?.id) {
            setSelectedAddressId(address.id);
        }
        showDeliveryError(null);
    };

    const handleAddressEditSuccess = async () => {
        const editedAddressId = editingAddressId;

        await refreshAddresses();
        if (editedAddressId) {
            setSelectedAddressId(editedAddressId);
        }
        setEditingAddressId(null);
        showDeliveryError(null);
    };

    return (
        <div className="min-h-screen bg-zinc-50 py-8 pb-32">
            <div className="container mx-auto px-4 max-w-6xl">
                <h1 className="text-3xl font-bold text-zinc-900 mb-8">{t('checkout.title')}</h1>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">

                        {hasNoActiveOrderType && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>{t('checkout.noOrderType')}</p>
                            </div>
                        )}

                        {/* Fulfillment — what the branch offers, and when */}
                        {orderTypeOptions.length > 1 && (
                            <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-3 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Truck className="text-orange-600 h-5 w-5" />
                                        {t('checkout.orderType')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {orderTypeOptions.map(({ value, labelKey, Icon }) => {
                                            const isSelected = orderType === value;

                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setOrderType(value)}
                                                    className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${isSelected
                                                        ? 'border-orange-600 bg-orange-50/60 text-orange-700'
                                                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-orange-200 hover:bg-orange-50/40'
                                                        }`}
                                                >
                                                    <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-orange-600' : 'text-zinc-500'}`} />
                                                    <span className="text-sm font-semibold text-zinc-900">{t(labelKey)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {isScheduled && targetBranchId && (
                                        <div className="border-t border-zinc-100 pt-4">
                                            <FulfillmentSlotPicker
                                                branchId={targetBranchId}
                                                orderType={orderType as ScheduledOrderType}
                                                selectedValue={scheduledFor}
                                                onChange={setScheduledFor}
                                                onStatusChange={setSlotStatus}
                                                refreshKey={slotRefreshKey}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Pickup happens at the branch — no address to choose. */}
                        {isPickup && branchSettings && (
                            <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-3 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Store className="text-orange-600 h-5 w-5" />
                                        {t('checkout.pickupBranch')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <p className="font-medium text-zinc-900">{branchSettings.name}</p>
                                    <p className="mt-1 text-sm text-zinc-500">{branchSettings.addressText}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Delivery Address */}
                        {!isPickup && (
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
                                            onClick={() => { setIsAddingAddress(true); showDeliveryError(null); }}
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
                                                                        showDeliveryError(null);
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
                        )}

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
                                {paymentMethodOptions.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                                        {t('checkout.noPaymentMethod')}
                                    </p>
                                ) : (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {paymentMethodOptions.map(({ value, labelKey, descriptionKey, Icon }) => {
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
                                )}
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
                                            cartItems={items}
                                            menuHref={targetBranchId ? `/branches/${targetBranchId}` : '/'}
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
                                            {formatCurrencyAmount(spendableBalance, balanceSymbol)}
                                        </div>
                                        {loyaltyWallet && (
                                            <p className="mt-1.5 text-xs text-zinc-500">
                                                {t(`cart.loyalty.providers.${loyaltyWallet.provider}`)}
                                                {balanceTypeLabel ? ` · ${balanceTypeLabel}` : ''}
                                            </p>
                                        )}
                                        {loyaltyWallet && !loyaltyWallet.usable && (
                                            <p className="mt-1 text-xs text-amber-600">{t('cart.loyalty.balanceNotUsable')}</p>
                                        )}
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
                                                    disabled={!isBalanceSpendable || !walletAmountInput}
                                                    className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {t('checkout.apply')}
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleUseMaxWallet}
                                                disabled={!isBalanceSpendable}
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
                        disabled={
                            // Pickup needs no address; a scheduled order needs a slot.
                            (!isPickup && (!selectedAddress || !selectedAddressHasPhone || isCheckingAddresses || isAddingAddress))
                            || !isScheduleReady
                            || paymentMethodOptions.length === 0
                            || isProcessing
                            || needsTotalReconfirm
                        }
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

