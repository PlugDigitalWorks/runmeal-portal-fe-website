'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cartService } from '@/services/cart.service';
import { userService } from '@/services/user.service';
import {
  ApplyPromotionInput,
  Cart,
  CartItemOptionGroup,
  CartPromotion,
  getCartId,
  RemovePromotionInput,
} from '@/types/cart';
import { Product } from '@/types/product';
import { useBranch } from './BranchContext';
import { useUser } from './UserContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  getApiErrorStatus,
  isCartStaleLoyaltyError,
  resolveLoyaltyErrorMessage,
} from '@/lib/loyalty-errors';
import { resolveApiErrorMessage } from '@/lib/api-errors';

type CartOptionInput = {
  groupId?: string;
  optionId?: string;
  optionIds?: string[];
  valueId?: string;
  name?: string;
  valueName?: string;
  price?: number;
};

type CartOptionDto = {
  groupId: string;
  optionId?: string;
  optionIds?: string[];
};

type CartAddonInput = { id: string; name?: string; price?: number };

export type { CartPromotion };

const DEFAULT_ORDER_TYPE = 'DELIVERY';

/** Identifies an in-flight promotion mutation; `*` covers "remove every promotion of this provider". */
const promotionMutationKey = (cartId: string, { type, promotionCode }: RemovePromotionInput) =>
  `${cartId}::${type}:${promotionCode ?? '*'}`;

// Simplified Cart Item for Guest (Local Storage)
interface GuestCartItem {
  productId: string;
  quantity: number;
  options?: CartItemOptionGroup[];
  addons?: { id: string; name?: string; price?: number }[];
  notes?: string;
  productName?: string;
  price?: number;
  branchId?: string;
}

interface CartContextType {
  // New API
  cart: Cart | null;
  guestCartItems: GuestCartItem[];
  isLoading: boolean;
  addToCart: (
    productId: string,
    quantity: number,
    options?: CartOptionInput[],
    addons?: CartAddonInput[],
    notes?: string,
    productDetails?: Product
  ) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  cartTotal: number;
  refreshCart: () => Promise<void>;
  isCartOpen: boolean;
  openCart: (cartId?: string) => void;
  closeCart: () => void;

  // Promotions — internal Runmeal coupons and Rekonect campaigns share one model.
  availablePromotionsByCart: Record<string, CartPromotion[]>;
  /** Bumped whenever the available-promotion lists go stale, e.g. cart items changed. */
  promotionsVersion: number;
  loadAvailablePromotions: (cartId: string) => Promise<void>;
  invalidateAvailablePromotions: () => void;
  /**
   * Order type the promotion lists are resolved for. A campaign can be valid on
   * delivery and not on pickup, so checkout pushes its selection in here and the
   * backend re-answers `available` accordingly.
   */
  promotionOrderType: string;
  setPromotionOrderType: (orderType: string) => void;
  isPromotionsLoading: (cartId: string) => boolean;
  hasPromotionsError: (cartId: string) => boolean;
  applyPromotion: (cartId: string, input: ApplyPromotionInput) => Promise<boolean>;
  removePromotion: (cartId: string, input: RemovePromotionInput) => Promise<boolean>;
  isPromotionPending: (cartId: string, input: RemovePromotionInput) => boolean;
  refreshSingleCart: (cartId: string) => Promise<Cart | null>;

  // Legacy API for CartDrawer compatibility
  carts: Cart[];
  refreshCarts: () => Promise<void>;
  clearCart: (cartId: string) => Promise<void>;
  selectedCartId: string | undefined;
  updateQty: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, refreshAddresses } = useUser();
  const { selectedBranch } = useBranch();
  const [cart, setCart] = useState<Cart | null>(null);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | undefined>(undefined);
  const [promotionOrderType, setPromotionOrderTypeState] = useState<string>(DEFAULT_ORDER_TYPE);
  const [availablePromotionsByCart, setAvailablePromotionsByCart] = useState<Record<string, CartPromotion[]>>({});
  const [promotionsLoadingCartIds, setPromotionsLoadingCartIds] = useState<string[]>([]);
  const [promotionsErrorCartIds, setPromotionsErrorCartIds] = useState<string[]>([]);
  const [promotionsVersion, setPromotionsVersion] = useState(0);
  const [pendingPromotionKeys, setPendingPromotionKeys] = useState<string[]>([]);
  /** Read inside callbacks that must not re-create on every cart change. */
  const cartsRef = useRef<Cart[]>([]);
  const promotionOrderTypeRef = useRef<string>(DEFAULT_ORDER_TYPE);
  const promotionsLoadingRef = useRef<Set<string>>(new Set());
  const pendingPromotionKeysRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const hasSyncedRef = useRef(false);

  const isAuthenticated = !!user;

  useEffect(() => {
    cartsRef.current = carts;
  }, [carts]);

  /**
   * Switching order type invalidates the cached lists: the same campaign can be
   * applicable on delivery and not on pickup.
   */
  const setPromotionOrderType = useCallback((orderType: string) => {
    if (promotionOrderTypeRef.current === orderType) return;
    promotionOrderTypeRef.current = orderType;
    setPromotionOrderTypeState(orderType);
    setPromotionsVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load Guest Cart
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guest_cart');
      if (stored) {
        try {
          setGuestCartItems(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse guest cart", e);
        }
      }
    }
  }, [isAuthenticated]);

  /**
   * Writes a cart returned by the API straight into cart state — the backend is the
   * single source of truth for `totalCartPrice` / `discountAmount` / `finalPrice`
   * and for `appliedPromotions`, so stale client-side promotions are never kept.
   */
  const upsertCart = useCallback((incoming: Cart | null | undefined) => {
    const incomingId = getCartId(incoming);
    if (!incoming || !incomingId) return;

    const merge = (previous: Cart | null | undefined): Cart => ({
      ...previous,
      ...incoming,
      appliedPromotions: incoming.appliedPromotions ?? [],
      isActive: incoming.isActive ?? previous?.isActive ?? true,
    });

    setCarts((previousCarts) => {
      const index = previousCarts.findIndex((candidate) => getCartId(candidate) === incomingId);
      if (index === -1) {
        return [...previousCarts, merge(null)];
      }

      const nextCarts = [...previousCarts];
      nextCarts[index] = merge(previousCarts[index]);
      return nextCarts;
    });

    setCart((previousCart) => (getCartId(previousCart) === incomingId ? merge(previousCart) : previousCart));
  }, []);

  /**
   * The branch a cart belongs to. Every cart call is branch scoped and the
   * portal holds one cart per branch, so the header has to follow the cart —
   * not whichever branch the user happens to be browsing.
   */
  const resolveCartBranchId = useCallback(
    (cartId: string) =>
      cartsRef.current.find((candidate) => getCartId(candidate) === cartId)?.branchId
        ?? selectedBranch?.id
        ?? null,
    [selectedBranch?.id],
  );

  /** Re-fetches a single cart. The backend re-validates promotions on every read. */
  const refreshSingleCart = useCallback(async (cartId: string) => {
    if (!isAuthenticated || !cartId) return null;

    try {
      const freshCart = await cartService.getCart(cartId, resolveCartBranchId(cartId));
      upsertCart(freshCart);
      return freshCart;
    } catch (error) {
      console.error(`Failed to refresh cart ${cartId}`, error);
      return null;
    }
  }, [isAuthenticated, upsertCart, resolveCartBranchId]);

  // Load User Carts (multi-cart) with full details including items
  const refreshCarts = useCallback(async () => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const allCarts = await cartService.getAllCarts();

        // Fetch full details for each cart to get items
        const fullCarts: Cart[] = [];
        for (const c of (allCarts || [])) {
          const cartId = c.id || c.cartId;
          if (cartId) {
            try {
              const fullCart = await cartService.getCart(cartId);
              // Merge: keep isActive and other fields from basic cart, add items from full cart
              fullCarts.push({
                ...c,           // Basic cart info (has isActive)
                ...fullCart,    // Full cart details (has items, totalCartPrice)
                isActive: c.isActive ?? fullCart.isActive ?? true, // Ensure isActive is preserved
              });
            } catch (e) {
              console.error(`Failed to fetch cart details for ${cartId}`, e);
              fullCarts.push(c); // Use basic info as fallback
            }
          }
        }

        setCarts(fullCarts);

        // Also set the first active cart as the main cart
        const activeCart = fullCarts.find(c => c.isActive);
        setCart(activeCart || null);
      } catch (err) {
        console.error("Failed to load user carts", err);
        setCarts([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setCarts([]);
      setCart(null);
    }
  }, [isAuthenticated]);

  // Alias for refreshCarts
  const refreshCart = refreshCarts;

  // Load carts when user changes (authentication state changes)
  useEffect(() => {
    if (user) {
      refreshCarts();
    }
  }, [user, refreshCarts]);

  // SYNC Logic: Guest -> User
  useEffect(() => {
    const syncCart = async () => {
      if (hasSyncedRef.current || !isAuthenticated || guestCartItems.length === 0) {
        return;
      }

      hasSyncedRef.current = true;
      console.log("Syncing guest cart to user...");
      setIsLoading(true);
      let syncFailed = false;

      try {
        // Sync guest address to user account
        const guestAddressStr = localStorage.getItem('guest_address');
        if (guestAddressStr) {
          try {
            const guestAddress = JSON.parse(guestAddressStr);
            const addressParts = guestAddress.formattedAddress.split(',').map((p: string) => p.trim());

            await userService.createAddress({
              countryCode: 'TR',
              province: addressParts[2] || addressParts[1] || 'Unknown',
              district: addressParts[1] || 'Unknown',
              postalCode: '00000',
              street: addressParts[0] || guestAddress.formattedAddress,
              buildingNumber: '-',
              apartmentNumber: '-',
              latitude: guestAddress.latitude,
              longitude: guestAddress.longitude,
              isActive: true
            });

            await refreshAddresses();
            localStorage.removeItem('guest_address');
          } catch (addrError) {
            console.error("Failed to sync guest address", addrError);
          }
        }

        for (const item of guestCartItems) {
          try {
            const options: { groupId: string; optionId?: string; optionIds?: string[] }[] = [];
            item.options?.forEach(group => {
              if (group.type === 'MULTI') {
                const ids = group.selections.map(s => s.optionId);
                if (ids.length > 0) {
                  options.push({ groupId: group.groupId, optionIds: ids });
                }
              } else {
                group.selections.forEach(sel => {
                  options.push({ groupId: group.groupId, optionId: sel.optionId });
                });
              }
            });

            const storedGuestBranch = localStorage.getItem('guest_branch');
            let fallbackBranchId: string | undefined;
            if (storedGuestBranch) {
              try { fallbackBranchId = JSON.parse(storedGuestBranch).id; } catch { }
            }

            await cartService.addItem({
              productId: item.productId,
              qty: item.quantity,
              options,
              note: item.notes?.trim() || undefined,
            }, item.branchId || selectedBranch?.id || fallbackBranchId);
          } catch (e) {
            console.error(`Failed to sync item ${item.productId}`, e);
            syncFailed = true;
          }
        }

        if (!syncFailed) {
          setGuestCartItems([]);
          localStorage.removeItem('guest_cart');
          localStorage.removeItem('guest_branch');
        } else {
          hasSyncedRef.current = false;
        }

        await refreshCarts();
      } catch (err) {
        console.error("Failed to sync cart", err);
        hasSyncedRef.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    syncCart();
  }, [isAuthenticated, guestCartItems, selectedBranch, refreshCarts, refreshAddresses]);

  const addToCart = async (
    productId: string,
    quantity: number,
    options?: CartOptionInput[],
    addons?: CartAddonInput[],
    notes?: string,
    productDetails?: Product
  ) => {
    if (isAuthenticated) {
      if (!selectedBranch?.id) {
        toast.error(t('cart.toast.selectBranch'));
        return;
      }

      setIsLoading(true);
      try {
        let optionsDto: CartOptionDto[] | undefined;

        if (options && options.length > 0 && 'groupId' in options[0]) {
          optionsDto = options
            .filter((option): option is CartOptionDto => Boolean(option.groupId))
            .map((option) => ({
              groupId: option.groupId,
              optionId: option.optionId,
              optionIds: option.optionIds,
            }));
        } else {
          optionsDto = options?.filter((option) => Boolean(option.optionId && option.valueId)).map(o => ({
            groupId: o.optionId,
            optionId: o.valueId
          })) as CartOptionDto[] | undefined;
        }

        const updatedCart = await cartService.addItem({
          productId,
          qty: quantity,
          options: optionsDto,
          note: notes?.trim() || undefined,
        }, selectedBranch.id);

        // Cart contents changed: the response carries the re-validated promotions.
        upsertCart(updatedCart);
        invalidateAvailablePromotions();
        toast.success(t('cart.toast.itemAdded'));
        await refreshCarts();
      } catch (e: unknown) {
        console.error("Add to cart failed", e);
        toast.error(resolveApiErrorMessage(e, t('cart.toast.addFailed')));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest Logic
      const nestedOptions: CartItemOptionGroup[] = [];

      if (options) {
        const groups: Record<string, CartItemOptionGroup> = {};

        options.forEach(opt => {
          let groupId: string, groupName: string, optionName: string, priceDelta: number;

          if ('groupId' in opt && opt.groupId) {
            groupId = opt.groupId as string;
            groupName = opt.name || 'Option Group';
            optionName = opt.valueName || 'Option Value';
            priceDelta = opt.price || 0;

            if (!groups[groupId]) {
              groups[groupId] = {
                groupId: groupId,
                groupName: groupName,
                type: (opt.optionIds && opt.optionIds.length > 0) ? 'MULTI' : 'VARIANT',
                selections: []
              };
            }

            if (opt.optionIds && Array.isArray(opt.optionIds)) {
              opt.optionIds.forEach(id => {
                groups[groupId].selections.push({
                  action: 'SELECT',
                  optionId: id,
                  optionName: optionName,
                  priceDelta: priceDelta
                });
              });
            } else if (opt.optionId) {
              groups[groupId].selections.push({
                action: 'SELECT',
                optionId: opt.optionId,
                optionName: optionName,
                priceDelta: priceDelta
              });
            }
          } else {
            groupId = opt.optionId || '';
            const singleOptionId = opt.valueId || '';
            groupName = opt.name || 'Option';
            optionName = opt.valueName || 'Value';
            priceDelta = opt.price || 0;

            if (!groups[groupId]) {
              groups[groupId] = {
                groupId: groupId,
                groupName: groupName,
                type: 'VARIANT',
                selections: []
              };
            }
            groups[groupId].selections.push({
              action: 'SELECT',
              optionId: singleOptionId,
              optionName: optionName,
              priceDelta: priceDelta
            });
          }
        });

        Object.values(groups).forEach(g => nestedOptions.push(g));
      }

      const updated = [...guestCartItems];
      const existing = updated.findIndex(i =>
        i.productId === productId &&
        JSON.stringify(i.options) === JSON.stringify(nestedOptions) &&
        JSON.stringify(i.addons) === JSON.stringify(addons) &&
        (i.notes || '') === (notes?.trim() || '')
      );

      if (existing >= 0) {
        updated[existing].quantity += quantity;
        if (!updated[existing].branchId && selectedBranch) {
          updated[existing].branchId = selectedBranch.id;
        }
      } else {
        const productPrice = Number(productDetails?.price);

        updated.push({
          productId,
          quantity,
          options: nestedOptions,
          addons,
          notes: notes?.trim() || undefined,
          productName: productDetails?.name,
          price: Number.isFinite(productPrice) ? productPrice : undefined,
          branchId: selectedBranch?.id
        });
      }
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));

      if (selectedBranch) {
        localStorage.setItem('guest_branch', JSON.stringify(selectedBranch));
      }

      toast.success(t('cart.toast.itemAdded'));
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const result = await cartService.removeItem(itemId, selectedBranch?.id);
        // Removing the last item returns `{ message }` instead of a cart.
        if (result && 'branchId' in result) {
          upsertCart(result as Cart);
        }
        invalidateAvailablePromotions();
        await refreshCarts();
      } catch (e) {
        console.error("Remove failed", e);
        toast.error(t('cart.toast.removeFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      const updated = guestCartItems.filter(i => i.productId !== itemId);
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));
    }
  };

  // Alias for removeFromCart
  const removeItem = removeFromCart;

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const updatedCart = await cartService.setQty({ itemId, qty: quantity }, selectedBranch?.id);
        upsertCart(updatedCart);
        invalidateAvailablePromotions();
        await refreshCarts();
      } catch (e) {
        console.error("Update qty failed", e);
        toast.error(t('cart.toast.updateFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
      }
      const updated = [...guestCartItems];
      const existing = updated.findIndex(i => i.productId === itemId);
      if (existing >= 0) {
        updated[existing].quantity = quantity;
        setGuestCartItems(updated);
        localStorage.setItem('guest_cart', JSON.stringify(updated));
      }
    }
  };

  // Alias for updateQuantity
  const updateQty = updateQuantity;

  const clearCart = async (cartId: string) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        await cartService.clearCart(cartId, resolveCartBranchId(cartId));
        invalidateAvailablePromotions();
        await refreshCarts();
        toast.success(t('cart.toast.cleared'));
      } catch (e) {
        console.error("Clear cart failed", e);
        toast.error(t('cart.toast.clearFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      setGuestCartItems([]);
      localStorage.removeItem('guest_cart');
    }
  };

  // --- Promotions ---------------------------------------------------------

  /** Marks every cached available-promotion list stale so mounted panels refetch. */
  const invalidateAvailablePromotions = useCallback(() => {
    setPromotionsVersion((version) => version + 1);
  }, []);

  const loadAvailablePromotions = useCallback(async (cartId: string) => {
    if (!isAuthenticated || !cartId) return;
    // One request per cart at a time; repeat effect runs reuse the in-flight one.
    if (promotionsLoadingRef.current.has(cartId)) return;

    promotionsLoadingRef.current.add(cartId);
    setPromotionsLoadingCartIds(Array.from(promotionsLoadingRef.current));

    try {
      const promotions = await cartService.getAvailablePromotions(
        cartId,
        promotionOrderTypeRef.current,
        resolveCartBranchId(cartId),
      );
      if (!isMountedRef.current) return;
      setAvailablePromotionsByCart((previous) => ({ ...previous, [cartId]: promotions ?? [] }));
      setPromotionsErrorCartIds((previous) => previous.filter((id) => id !== cartId));
    } catch (error) {
      // An empty or failed list must never break the page — surface it inline instead.
      console.error('Failed to fetch available promotions', error);
      if (!isMountedRef.current) return;
      setAvailablePromotionsByCart((previous) => ({ ...previous, [cartId]: previous[cartId] ?? [] }));
      setPromotionsErrorCartIds((previous) => (previous.includes(cartId) ? previous : [...previous, cartId]));
    } finally {
      promotionsLoadingRef.current.delete(cartId);
      if (isMountedRef.current) {
        setPromotionsLoadingCartIds(Array.from(promotionsLoadingRef.current));
      }
    }
  }, [isAuthenticated, resolveCartBranchId]);

  const isPromotionsLoading = useCallback(
    (cartId: string) => promotionsLoadingCartIds.includes(cartId),
    [promotionsLoadingCartIds],
  );

  const hasPromotionsError = useCallback(
    (cartId: string) => promotionsErrorCartIds.includes(cartId),
    [promotionsErrorCartIds],
  );

  const isPromotionPending = useCallback(
    (cartId: string, input: RemovePromotionInput) => pendingPromotionKeys.includes(promotionMutationKey(cartId, input)),
    [pendingPromotionKeys],
  );

  /** Returns false when the same mutation is already in flight (double-click guard). */
  const beginPromotionMutation = useCallback((key: string) => {
    if (pendingPromotionKeysRef.current.has(key)) return false;
    pendingPromotionKeysRef.current.add(key);
    setPendingPromotionKeys(Array.from(pendingPromotionKeysRef.current));
    return true;
  }, []);

  const endPromotionMutation = useCallback((key: string) => {
    pendingPromotionKeysRef.current.delete(key);
    if (isMountedRef.current) {
      setPendingPromotionKeys(Array.from(pendingPromotionKeysRef.current));
    }
  }, []);

  const handlePromotionError = useCallback(async (error: unknown, cartId: string, fallbackKey: string) => {
    console.error('Promotion request failed', error);

    // 401 is owned by the axios interceptor (silent refresh, then login redirect).
    if (getApiErrorStatus(error) === 401) return;

    if (isMountedRef.current) {
      toast.error(resolveLoyaltyErrorMessage(error, t, fallbackKey));
    }

    // The backend already dropped whatever stopped being valid — resync from it.
    if (isCartStaleLoyaltyError(error)) {
      await refreshSingleCart(cartId);
      invalidateAvailablePromotions();
    }
  }, [t, refreshSingleCart, invalidateAvailablePromotions]);

  const applyPromotion = useCallback(async (cartId: string, input: ApplyPromotionInput) => {
    if (!isAuthenticated || !cartId || !input.promotionCode) return false;

    const key = promotionMutationKey(cartId, input);
    if (!beginPromotionMutation(key)) return false;

    try {
      const updatedCart = await cartService.applyPromotion(
        cartId,
        input,
        promotionOrderTypeRef.current,
        resolveCartBranchId(cartId),
      );
      upsertCart(updatedCart);
      invalidateAvailablePromotions();
      if (isMountedRef.current) {
        toast.success(t('cart.loyalty.toast.applied'));
      }
      return true;
    } catch (error) {
      await handlePromotionError(error, cartId, 'cart.loyalty.toast.applyFailed');
      return false;
    } finally {
      endPromotionMutation(key);
    }
  }, [
    isAuthenticated,
    beginPromotionMutation,
    endPromotionMutation,
    upsertCart,
    invalidateAvailablePromotions,
    handlePromotionError,
    resolveCartBranchId,
    t,
  ]);

  /** Omitting `promotionCode` removes every promotion of that provider from the cart. */
  const removePromotion = useCallback(async (cartId: string, input: RemovePromotionInput) => {
    if (!isAuthenticated || !cartId) return false;

    const key = promotionMutationKey(cartId, input);
    if (!beginPromotionMutation(key)) return false;

    try {
      const updatedCart = await cartService.removePromotion(cartId, input, resolveCartBranchId(cartId));
      upsertCart(updatedCart);
      invalidateAvailablePromotions();
      if (isMountedRef.current) {
        toast.success(t('cart.loyalty.toast.removed'));
      }
      return true;
    } catch (error) {
      await handlePromotionError(error, cartId, 'cart.loyalty.toast.removeFailed');
      return false;
    } finally {
      endPromotionMutation(key);
    }
  }, [
    isAuthenticated,
    beginPromotionMutation,
    endPromotionMutation,
    upsertCart,
    invalidateAvailablePromotions,
    handlePromotionError,
    resolveCartBranchId,
    t,
  ]);

  const cartTotal = isAuthenticated
    ? (cart?.totalCartPrice || 0)
    : guestCartItems.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);

  const openCart = (cartId?: string) => {
    setSelectedCartId(cartId);
    setIsCartOpen(true);
  };

  const closeCart = () => setIsCartOpen(false);

  return (
    <CartContext.Provider value={{
      // New API
      cart,
      guestCartItems,
      isLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      cartTotal,
      refreshCart,
      isCartOpen,
      openCart,
      closeCart,
      // Promotions
      availablePromotionsByCart,
      promotionsVersion,
      loadAvailablePromotions,
      invalidateAvailablePromotions,
      promotionOrderType,
      setPromotionOrderType,
      isPromotionsLoading,
      hasPromotionsError,
      applyPromotion,
      removePromotion,
      isPromotionPending,
      refreshSingleCart,
      // Legacy API
      carts,
      refreshCarts,
      clearCart,
      selectedCartId,
      updateQty,
      removeItem
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
