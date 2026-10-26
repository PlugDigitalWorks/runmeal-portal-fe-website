'use client';

import { Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { useUser } from '@/context/UserContext';
import { userService } from '@/services/user.service';
import { AddressSaveModal } from '@/components/address/AddressSaveModal';
import { HeaderSearch } from '@/components/layout/HeaderSearch';
import { AddressPickerDialog, LocationChip } from '@/components/location/AddressPicker';

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
            // The search term lives in the query string, which needs a Suspense boundary.
            searchComponent={
              <Suspense fallback={null}>
                <HeaderSearch />
              </Suspense>
            }
            // Signed-in users with saved addresses keep their address selector.
            locationComponent={user && addresses.length > 0 ? undefined : <LocationChip className="max-w-[140px] md:max-w-[220px]" />}
        />
      </div>
      <AddressSaveModal />
      <AddressPickerDialog />
    </>
  );
}
