'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from '@/types/auth';
import { Address } from '@/types/address';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { usePathname } from 'next/navigation';

interface UserContextType {
  user: User | null;
  addresses: Address[];
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  refreshAddresses: () => Promise<void>;
  setUser: (user: User | null) => void;
  tempAddress: { location: { latitude: number; longitude: number; }; formattedAddress: string; } | null;
  setTempAddress: (addr: { location: { latitude: number; longitude: number; }; formattedAddress: string; } | null) => void;
  showAddressModal: boolean;
  setShowAddressModal: (show: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

type TempAddress = NonNullable<UserContextType['tempAddress']>;

/** The delivery address a visitor picked, kept for the browser session. */
const TEMP_ADDRESS_KEY = 'runmeal_temp_address';

const readStoredTempAddress = (): TempAddress | null => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(TEMP_ADDRESS_KEY) ?? 'null');
    const { latitude, longitude } = stored?.location ?? {};
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { location: { latitude, longitude }, formattedAddress: String(stored.formattedAddress ?? '') }
      : null;
  } catch {
    return null;
  }
};

const storeTempAddress = (address: TempAddress | null) => {
  try {
    if (address) sessionStorage.setItem(TEMP_ADDRESS_KEY, JSON.stringify(address));
    else sessionStorage.removeItem(TEMP_ADDRESS_KEY);
  } catch {
    // Storage blocked: the address lasts until the page is closed.
  }
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tempAddress, setTempAddressState] = useState<TempAddress | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const pathname = usePathname();

  const setTempAddress = useCallback((address: TempAddress | null) => {
    storeTempAddress(address);
    setTempAddressState(address);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = authService.getUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user', error);
      setUser(null);
    }
  }, []);

  const refreshAddresses = useCallback(async () => {
    try {
      const addrs = await userService.getAddresses();
      setAddresses(addrs || []);
    } catch (error) {
      console.error('Failed to fetch addresses', error);
    }
  }, []);

  // Initial load or on route change for user validity
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshUser();
      // Restored before loading ends so the first search already uses it.
      setTempAddressState((current) => current ?? readStoredTempAddress());
      
      const currentUser = authService.getUser();
      if (currentUser) {
          await refreshAddresses();
      } else {
          setAddresses([]);
      }
      setIsLoading(false);
    };

    init();
  }, [pathname, refreshUser, refreshAddresses]);

  return (
    <UserContext.Provider
      value={{
        user,
        addresses,
        isLoading,
        refreshUser,
        refreshAddresses,
        setUser,
        tempAddress,
        setTempAddress,
        showAddressModal,
        setShowAddressModal
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
