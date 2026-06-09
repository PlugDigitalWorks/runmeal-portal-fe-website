'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ApiResponse } from '@/types/auth';
import { Address } from '@/types/address';
import { userService } from '@/services/user.service';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Save } from 'lucide-react';
import { LocationPicker, GeocodedAddress, AddressComponent, Location } from '@/components/ui/LocationPicker';
import { AddressSelects } from '@/components/ui/AddressSelects';
import { Country, State, City } from 'country-state-city';
import { useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Helper to normalize strings for comparison
const normalizeName = (name: string) => {
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/ı/g, 'i')
        .replace(/i/g, 'i') 
        .trim();
};

// Schema for Address
export const createAddressSchema = (t: TFunction) => z.object({
  countryCode: z.string().min(1, t('address.validation.countryRequired')),
  district: z.string().min(1, t('address.validation.districtRequired')),
  province: z.string().min(1, t('address.validation.provinceRequired')),
  phoneE164: z.string()
    .trim()
    .min(1, t('address.validation.phoneRequired'))
    .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), t('address.validation.phoneFormat')),
  postalCode: z.string().min(1, t('address.validation.postalRequired')),
  street: z.string().min(1, t('address.validation.streetRequired')),
  buildingNumber: z.string().min(1, t('address.validation.buildingRequired')),
  apartmentNumber: z.string().min(1, t('address.validation.apartmentRequired')),
  latitude: z.any().transform(val => Number(val)),
  longitude: z.any().transform(val => Number(val)),
});

export type AddressFormValues = {
  countryCode: string;
  district: string;
  province: string;
  phoneE164: string;
  postalCode: string;
  street: string;
  buildingNumber: string;
  apartmentNumber: string;
  latitude: number;
  longitude: number;
};

interface AddressFormProps {
    initialValues?: Partial<AddressFormValues>;
    addressId?: string | null;
    onCancel: () => void;
    onSuccess: (address?: Address) => Promise<void>;
    resolveCreateIsActive?: (data: AddressFormValues) => Promise<boolean> | boolean;
}

export function AddressForm({ initialValues, addressId, onCancel, onSuccess, resolveCreateIsActive }: AddressFormProps) {
  const { t } = useTranslation();
  const addressSchema = createAddressSchema(t);
  const [addressLoading, setAddressLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const ignoreSearchRef = useRef(false);

  const defaultValues = {
      countryCode: 'TR', 
      district: 'Fatih', 
      province: 'İstanbul', 
      phoneE164: '',
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
    setFormError(null);
    try {
      if (addressId) {
          // Update existing
          const updated = await userService.updateAddress(addressId, data);
          if (updated) {
               await onSuccess();
          }
      } else {
          // Create new
          const isActive = resolveCreateIsActive ? await resolveCreateIsActive(data) : true;
          let newAddress = await userService.createAddress({ ...data, isActive });
          if (!isActive && newAddress?.isActive) {
              newAddress = await userService.updateAddress(newAddress.id, { isActive: false });
          }
          if (newAddress) {
               await onSuccess(newAddress);
          }
      }
    } catch (err) {
      const error = err as AxiosError<ApiResponse<unknown>>;
      console.error('Failed to save address', error);
      const serverMessage = error.response?.data?.message;
      if (error.response?.status === 429) {
          setFormError(t('address.tooManyRequests'));
      } else {
          setFormError(serverMessage || t('address.saveFailed'));
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
            <Input label={t('address.country')} {...register('countryCode')} />
            <Input label={t('address.district')} {...register('district')} />
            <Input label={t('address.province')} {...register('province')} />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
                label={t('address.phone')}
                type="tel"
                placeholder="+905551112233"
                {...register('phoneE164')}
                error={errors.phoneE164?.message}
            />
            <Input label={t('address.postalCode')} placeholder="34000" {...register('postalCode')} error={errors.postalCode?.message} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('address.street')} {...register('street')} error={errors.street?.message} />
            <Input label={t('address.buildingNo')} {...register('buildingNumber')} error={errors.buildingNumber?.message} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('address.apartment')} {...register('apartmentNumber')} error={errors.apartmentNumber?.message} />
        </div>

        {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
            </div>
        )}

        <div className="flex justify-end pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
                {t('address.cancel')}
            </Button>
            <Button type="submit" isLoading={addressLoading}>
                <Save className="h-4 w-4 mr-2" /> {addressId ? t('address.updateAddress') : t('address.saveAddress')}
            </Button>
        </div>
    </form>
  );
}
