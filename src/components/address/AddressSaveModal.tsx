'use client';

import { useUser } from '@/context/UserContext';
import { AddressForm } from '@/components/address/AddressForm';
import { X } from 'lucide-react';

export function AddressSaveModal() {
  const { showAddressModal, setShowAddressModal, tempAddress, setTempAddress, refreshAddresses } = useUser();

  const handleClose = () => {
    setShowAddressModal(false);
  };

  const handleSuccess = async () => {
      await refreshAddresses();
      setTempAddress(null);
      setShowAddressModal(false);
  };

  if (!showAddressModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
        
        {/* Content */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-zinc-100 p-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-zinc-900">Save Delivery Address</h2>
                <button 
                  onClick={handleClose}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <X className="h-5 w-5 text-zinc-500" />
                </button>
            </div>
            
            <div className="p-6">
                <div className="mb-6 p-4 bg-orange-50 text-orange-800 rounded-lg text-sm border border-orange-100">
                    Please save this address to continue adding items to your cart.
                </div>

                <AddressForm
                    onCancel={handleClose}
                    onSuccess={handleSuccess}
                    initialValues={tempAddress ? {
                        latitude: tempAddress.location.latitude,
                        longitude: tempAddress.location.longitude,
                        // Could try to pre-fill detailed address if we had formattedAddress parsed, 
                        // but LocationPicker inside AddressForm will handle reverse geocoding from lat/lng
                    } : undefined}
                />
            </div>
        </div>
    </div>
  );
}
