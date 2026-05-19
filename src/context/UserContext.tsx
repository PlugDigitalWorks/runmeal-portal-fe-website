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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tempAddress, setTempAddress] = useState<{ location: { latitude: number; longitude: number; }; formattedAddress: string; } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const pathname = usePathname();

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
