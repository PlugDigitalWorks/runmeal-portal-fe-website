'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { useUser } from '@/context/UserContext';
import { userService } from '@/services/user.service';
import { AddressSearch } from '@/components/ui/AddressSearch';
import { AddressSaveModal } from '@/components/address/AddressSaveModal';

export function GlobalHeader() {
  const { user, addresses, refreshAddresses } = useUser();
  const pathname = usePathname();

  const router = useRouter();

  const handleAddressChange = async (addressId: string) => {
      try {
          const addr = addresses.find(a => a.id === addressId);
          if (!addr) return;

          if (addr.isActive) return;

          await userService.updateAddress(addressId, { isActive: true });
          
          await refreshAddresses();
          router.push('/');
      } catch (error) {
          console.error("Failed to set active address", error);
      }
  };

  if (['/login', '/register'].includes(pathname)) {
    return null;
  }

  return (
    <>
      <div className="relative z-50">
        <Header 
            user={user} 
            addresses={addresses} 
            onAddressSelect={handleAddressChange} 
            searchComponent={<AddressSearch />}
        />
      </div>
      <AddressSaveModal />
    </>
  );
}
