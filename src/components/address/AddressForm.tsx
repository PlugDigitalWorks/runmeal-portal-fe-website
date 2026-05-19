'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ApiResponse } from '@/types/auth';
import { userService } from '@/services/user.service';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { LocationPicker, GeocodedAddress, AddressComponent, Location } from '@/components/ui/LocationPicker';
import { AddressSelects } from '@/components/ui/AddressSelects';
import { Country, State, City } from 'country-state-city';
import { useCallback, useRef, useEffect, useState } from 'react';

// Helper to normalize strings for comparison
const normalizeName = (name: string) => {
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/ı/g, 'i')
        .replace(/i/g, 'i') 
        .trim();
};

// Schema for Address
export const addressSchema = z.object({
  countryCode: z.string().min(1, 'Country is required'),
  district: z.string().min(1, 'District/City is required'),
  province: z.string().min(1, 'Province/State is required'),
  postalCode: z.string().min(1, 'Postal Code is required'),
  street: z.string().min(1, 'Street is required'),
  buildingNumber: z.string().min(1, 'Building is required'),
  apartmentNumber: z.string().min(1, 'Apartment is required'),
  latitude: z.any().transform(val => Number(val)),
  longitude: z.any().transform(val => Number(val)), 
});

export type AddressFormValues = z.infer<typeof addressSchema>;

interface AddressFormProps {
    initialValues?: Partial<AddressFormValues>;
    addressId?: string | null;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

export function AddressForm({ initialValues, addressId, onCancel, onSuccess }: AddressFormProps) {
  const [addressLoading, setAddressLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState<string | undefined>(undefined);
  const ignoreSearchRef = useRef(false);

  const defaultValues = {
      countryCode: 'TR', 
      district: 'Fatih', 
      province: 'İstanbul', 
      postalCode: '', 
      street: '', 
      buildingNumber: '', 
      apartmentNumber: '', 
      latitude: undefined, 
      longitude: undefined,
      ...initialValues
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues as import('react-hook-form').DefaultValues<AddressFormValues> 
  });

  const watchedFields = watch(['countryCode', 'district', 'street']);

  useEffect(() => {
     if (ignoreSearchRef.current) {
         ignoreSearchRef.current = false;
         return;
     }

     const timer = setTimeout(() => {
         const [countryCode, district, street] = watchedFields;
         if (countryCode || district || street) {

             const parts = [street, district, countryCode].filter(Boolean);
             if (parts.length > 0) {
                setSearchAddress(parts.join(', '));
             }
         }
     }, 1000);

     return () => clearTimeout(timer);
  }, [watchedFields]);

  const handleAddressSelect = useCallback((address: GeocodedAddress) => {
      ignoreSearchRef.current = true;
      
      const components = address.address_components;
      const getComponent = (type: string) => components.find((c: AddressComponent) => c.types.includes(type))?.long_name || '';

      const countryRaw = getComponent('country');
      const administrativeAreaLevel1 = getComponent('administrative_area_level_1');
      const administrativeAreaLevel2 = getComponent('administrative_area_level_2');
      const locality = getComponent('locality');
      const sublocality = getComponent('sublocality');
      const postalCode = getComponent('postal_code');
      const route = getComponent('route');
      const streetNumber = getComponent('street_number');

      // 1. Match Country
      const allCountries = Country.getAllCountries();
      let matchedCountry = allCountries.find(c => 
          normalizeName(c.name) === normalizeName(countryRaw) || 
          c.isoCode === countryRaw || 
          normalizeName(c.name).includes(normalizeName(countryRaw))
      );

      // Explicit fix for Türkiye -> Turkey if not found above
      if (!matchedCountry && (countryRaw.toLowerCase() === 'türkiye' || countryRaw.toLowerCase() === 'turkiye')) {
          matchedCountry = allCountries.find(c => c.isoCode === 'TR');
      }

      const countryCode = matchedCountry?.isoCode || 'TR';

      // 2. Match State (Province)
      let finalState = '';
      let stateCode = '';

      if (matchedCountry) {
          const countryStates = State.getStatesOfCountry(countryCode);
          const matchedState = countryStates.find(s => 
              normalizeName(s.name) === normalizeName(administrativeAreaLevel1) ||
              s.isoCode === administrativeAreaLevel1 ||
              normalizeName(s.name).includes(normalizeName(administrativeAreaLevel1))
          );
          
          if (matchedState) {
              finalState = matchedState.name;
              stateCode = matchedState.isoCode;
          }
      }

      // 3. Match City (District)
      let finalCity = '';
      const possibleCities = [locality, administrativeAreaLevel2, sublocality].filter(Boolean);
      
      if (countryCode && stateCode) {
           const stateCities = City.getCitiesOfState(countryCode, stateCode);
           const matchedCity = stateCities.find(c => possibleCities.some(pc => normalizeName(c.name) === normalizeName(pc)));
           if (matchedCity) {
               finalCity = matchedCity.name;
           }
      }

      // Fallback
      if (!finalCity && possibleCities.length > 0) finalCity = possibleCities[0];
      if (!finalState && administrativeAreaLevel1) finalState = administrativeAreaLevel1;

      // Address Line
      const street = route ? `${route}` : '';
      const building = streetNumber; 

      setValue('countryCode', countryCode);
      setValue('province', finalState);
      setValue('district', finalCity);
      
      setValue('postalCode', postalCode || '');
      setValue('street', street || '');
      if (building) setValue('buildingNumber', building);
      
      setSearchAddress(undefined);
  }, [setValue]);

  const onSubmit = async (data: AddressFormValues) => {
    setAddressLoading(true);
    try {
      if (addressId) {
          // Update existing
          const updated = await userService.updateAddress(addressId, data);
          if (updated) {
               await onSuccess();
          }
      } else {
          // Create new
          const newAddress = await userService.createAddress({ ...data, isActive: true });
          if (newAddress) {
               await onSuccess();
          }
      }
    } catch (err) {
      const error = err as AxiosError<ApiResponse<unknown>>;
      console.error('Failed to save address', error);
      if (error.response?.status === 429) {
          alert('You are sending requests too quickly. Please wait a moment.');
      } else {
          alert('Failed to save address');
      }
    } finally {
      setAddressLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
            <LocationPicker
                value={
                    watch('latitude') && watch('longitude')
                        ? { latitude: Number(watch('latitude')), longitude: Number(watch('longitude')) }
                        : undefined
                }
                onChange={(loc: Location) => {
                    setValue('latitude', loc.latitude);
                    setValue('longitude', loc.longitude);
                }}
                onAddressSelect={handleAddressSelect}
                searchQuery={searchAddress}
            />
        </div>

        <AddressSelects 
            control={control} 
            setValue={setValue}
            currentCountry={watch('countryCode')}
            currentState={watch('province')}
            errors={errors}
            className="col-span-full"
            onLocationChange={(lat, lng) => {
                setValue('latitude', lat);
                setValue('longitude', lng);
            }}
         />
         {/* Hidden inputs to register fields if needed, or rely on Controller */ }
        <div className="hidden">
            <Input label="Country" {...register('countryCode')} />
            <Input label="District" {...register('district')} />
            <Input label="Province" {...register('province')} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Postal Code" placeholder="34000" {...register('postalCode')} error={errors.postalCode?.message} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Street" {...register('street')} error={errors.street?.message} />
            <Input label="Building No" {...register('buildingNumber')} error={errors.buildingNumber?.message} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Apartment" {...register('apartmentNumber')} error={errors.apartmentNumber?.message} />
        </div>

        <div className="flex justify-end pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
            </Button>
            <Button type="submit" isLoading={addressLoading}>
                <Save className="h-4 w-4 mr-2" /> {addressId ? 'Update Address' : 'Save Address'}
            </Button>
        </div>
    </form>
  );
}
