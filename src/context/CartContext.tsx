'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cartService } from '@/services/cart.service';
import { userService } from '@/services/user.service';
import { Cart, CartItem, CartItemOptionGroup } from '@/types/cart';
import { useBranch } from './BranchContext';
import { useUser } from './UserContext';
import { toast } from 'sonner';

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
    options?: { groupId?: string; optionId?: string; optionIds?: string[]; valueId?: string; name?: string; valueName?: string; price?: number }[],
    addons?: { id: string; name?: string; price?: number }[],
    notes?: string,
    productDetails?: any
  ) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  applyCoupon: (couponCode: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  cartTotal: number;
  availablePromotions: any[];
  checkAvailablePromotions: () => Promise<void>;
  refreshCart: () => Promise<void>;
  isCartOpen: boolean;
  openCart: (cartId?: string) => void;
  closeCart: () => void;

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
  const { user, refreshAddresses } = useUser();
  const { selectedBranch } = useBranch();
  const [cart, setCart] = useState<Cart | null>(null);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | undefined>(undefined);
  const [availablePromotions, setAvailablePromotions] = useState<any[]>([]);
  const hasSyncedRef = useRef(false);

  const isAuthenticated = !!user;

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
    options?: { groupId?: string; optionId?: string; optionIds?: string[]; valueId?: string; name?: string; valueName?: string; price?: number }[],
    addons?: { id: string; name?: string; price?: number }[],
    notes?: string,
    productDetails?: any
  ) => {
    if (isAuthenticated) {
      if (!selectedBranch?.id) {
        toast.error('Please select a branch before adding items to cart.');
        return;
      }

      setIsLoading(true);
      try {
        let optionsDto: any[] | undefined;

        if (options && options.length > 0 && 'groupId' in options[0]) {
          optionsDto = options;
        } else {
          optionsDto = options?.map(o => ({
            groupId: o.optionId,
            optionId: o.valueId
          }));
        }

        await cartService.addItem({
          productId,
          qty: quantity,
          options: optionsDto
        }, selectedBranch.id);

        toast.success('Item added to cart');
        await refreshCarts();
      } catch (e: any) {
        console.error("Add to cart failed", e);
        toast.error(e.response?.data?.message || 'Failed to add item to cart');
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
            const legacyOpt = opt as any;
            groupId = legacyOpt.optionId;
            const singleOptionId = legacyOpt.valueId;
            groupName = legacyOpt.name || 'Option';
            optionName = legacyOpt.valueName || 'Value';
            priceDelta = legacyOpt.price || 0;

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
        JSON.stringify(i.addons) === JSON.stringify(addons)
      );

      if (existing >= 0) {
        updated[existing].quantity += quantity;
        if (!updated[existing].branchId && selectedBranch) {
          updated[existing].branchId = selectedBranch.id;
        }
      } else {
        updated.push({
          productId,
          quantity,
          options: nestedOptions,
          addons,
          productName: productDetails?.name,
          price: productDetails?.price,
          branchId: selectedBranch?.id
        });
      }
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));

      if (selectedBranch) {
        localStorage.setItem('guest_branch', JSON.stringify(selectedBranch));
      }

      toast.success('Item added to cart');
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        await cartService.removeItem(itemId, selectedBranch?.id);
        await refreshCarts();
      } catch (e) {
        console.error("Remove failed", e);
        toast.error('Failed to remove item');
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
        await cartService.setQty({ itemId, qty: quantity }, selectedBranch?.id);
        await refreshCarts();
      } catch (e) {
        console.error("Update qty failed", e);
        toast.error('Failed to update quantity');
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
        await cartService.clearCart(cartId);
        await refreshCarts();
        toast.success('Cart cleared');
      } catch (e) {
        console.error("Clear cart failed", e);
        toast.error('Failed to clear cart');
      } finally {
        setIsLoading(false);
      }
    } else {
      setGuestCartItems([]);
      localStorage.removeItem('guest_cart');
    }
  };

  const applyCoupon = async (couponCode: string) => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId || !selectedBranch?.id) return;
    setIsLoading(true);
    try {
      await cartService.applyPromotion(
        cartId,
        couponCode,
        selectedBranch.id,
        cart!.totalCartPrice || 0,
        'DELIVERY'
      );
      toast.success('Coupon applied successfully');
      await refreshCarts();
    } catch (e: any) {
      console.error("Apply coupon failed", e);
      toast.error(e.response?.data?.message || 'Failed to apply coupon');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoupon = async () => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId) return;
    setIsLoading(true);
    try {
      await cartService.removePromotion(cartId);
      toast.success('Coupon removed');
      await refreshCarts();
    } catch (e: any) {
      console.error("Remove coupon failed", e);
      toast.error(e.response?.data?.message || 'Failed to remove coupon');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAvailablePromotions = async () => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId) return;
    try {
      const promos = await cartService.getAvailablePromotions(cartId, 'DELIVERY');
      setAvailablePromotions(promos || []);
    } catch (e) {
      console.error("Failed to fetch available promotions", e);
    }
  };

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
      applyCoupon,
      removeCoupon,
      cartTotal,
      availablePromotions,
      checkAvailablePromotions,
      refreshCart,
      isCartOpen,
      openCart,
      closeCart,
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
