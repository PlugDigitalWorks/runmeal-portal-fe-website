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
import {
    NOTE_MAX_LENGTH,
    SECOND_LINE_MAX_LENGTH,
    STREET_MAX_LENGTH,
    composeFirstLine,
    formatAddressFirstLine,
    joinAddressLines,
} from '@/lib/address-lines';

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
  // Address line 1; line 2 is optional and both go to the API joined as `street`.
  street: z.string().trim()
    .min(2, t('address.validation.firstLineRequired'))
    .max(STREET_MAX_LENGTH, t('address.validation.lineMax', { max: STREET_MAX_LENGTH })),
  line2: z.string().trim().max(SECOND_LINE_MAX_LENGTH, t('address.validation.lineMax', { max: SECOND_LINE_MAX_LENGTH })),
  note: z.string().trim().max(NOTE_MAX_LENGTH, t('address.validation.noteMax', { max: NOTE_MAX_LENGTH })),
  latitude: z.any().transform(val => Number(val)),
  longitude: z.any().transform(val => Number(val)),
}).superRefine((values, ctx) => {
  // A saved address can already fill line 1 close to the limit.
  if (joinAddressLines(values.street, values.line2).length > STREET_MAX_LENGTH) {
    ctx.addIssue({ code: 'custom', path: ['line2'], message: t('address.validation.linesTooLong', { max: STREET_MAX_LENGTH }) });
  }
});

export type AddressFormValues = {
  countryCode: string;
  district: string;
  province: string;
  phoneE164: string;
  postalCode: string;
  street: string;
  line2: string;
  note: string;
  latitude: number;
  longitude: number;
};

interface AddressFormProps {
    /** A saved address to edit, or a starting point (e.g. only a location). */
    initialValues?: Partial<Address>;
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
      countryCode: initialValues?.countryCode || 'TR',
      district: initialValues?.district || 'Fatih',
      province: initialValues?.province || 'İstanbul',
      phoneE164: initialValues?.phoneE164 ?? '',
      postalCode: initialValues?.postalCode ?? '',
      // A saved address keeps one joined line; it comes back whole in line 1.
      street: initialValues?.street
          ? formatAddressFirstLine({ street: initialValues.street, buildingNumber: initialValues.buildingNumber ?? null })
          : '',
      line2: '',
      note: initialValues?.note ?? '',
      latitude: initialValues?.latitude,
      longitude: initialValues?.longitude,
  };

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
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
      const countryIso = (components.find((c: AddressComponent) => c.types.includes('country'))?.short_name || '').toUpperCase();
      const administrativeAreaLevel1 = getComponent('administrative_area_level_1');
      const administrativeAreaLevel2 = getComponent('administrative_area_level_2');
      const locality = getComponent('locality');
      const sublocality = getComponent('sublocality');
      const postalCode = getComponent('postal_code');
      const route = getComponent('route');
      const streetNumber = getComponent('street_number');

      // 1. Match Country
      const allCountries = Country.getAllCountries();
      // ISO code from Google is language independent, so prefer it over name matching.
      let matchedCountry = allCountries.find(c => c.isoCode === countryIso) ||
          allCountries.find(c =>
              normalizeName(c.name) === normalizeName(countryRaw) ||
              c.isoCode === countryRaw ||
              (countryRaw && normalizeName(c.name).includes(normalizeName(countryRaw)))
          );

      // Explicit fix for Türkiye -> Turkey if not found above
      if (!matchedCountry && (countryRaw.toLowerCase() === 'türkiye' || countryRaw.toLowerCase() === 'turkiye')) {
          matchedCountry = allCountries.find(c => c.isoCode === 'TR');
      }

      // Never silently switch to TR; keep the current country when nothing matched.
      const countryCode = matchedCountry?.isoCode || getValues('countryCode');

      // 2. Match State (Province)
      let finalState = '';
      let stateCode = '';

      if (countryCode) {
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

      // Address line 1: street and house number in the country's order.
      const street = composeFirstLine(route, streetNumber, countryCode);

      setValue('countryCode', countryCode);
      setValue('province', finalState);
      setValue('district', finalCity);
      
      setValue('postalCode', postalCode || '');
      if (street) setValue('street', street);
      
      setSearchAddress(undefined);
  }, [setValue, getValues]);

  const onSubmit = async (data: AddressFormValues) => {
    setAddressLoading(true);
    setFormError(null);
    // Both lines go as one `street`; `buildingNumber: null` drops a number an
    // older row kept apart, and `note` always goes along ("" clears it).
    const { line2, ...fields } = data;
    const payload = { ...fields, street: joinAddressLines(fields.street, line2), buildingNumber: null };
    try {
      if (addressId) {
          // Update existing
          const updated = await userService.updateAddress(addressId, payload);
          if (updated) {
               await onSuccess();
          }
      } else {
          // Create new
          const isActive = resolveCreateIsActive ? await resolveCreateIsActive(data) : true;
          let newAddress = await userService.createAddress({ ...payload, isActive });
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
         {/* Left: where the address is (postcode, lines); right: how to reach the door. */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
                <Input
                    label={t('address.postalCode')}
                    placeholder="34000"
                    autoComplete="postal-code"
                    {...register('postalCode')}
                    error={errors.postalCode?.message}
                />
                <Input
                    label={t('address.firstLine')}
                    autoComplete="address-line1"
                    maxLength={STREET_MAX_LENGTH}
                    {...register('street')}
                    error={errors.street?.message}
                />
                <Input
                    label={`${t('address.secondLine')} (${t('address.optional')})`}
                    autoComplete="address-line2"
                    maxLength={SECOND_LINE_MAX_LENGTH}
                    {...register('line2')}
                    error={errors.line2?.message}
                />
            </div>
            <div className="space-y-4">
                <Input
                    label={t('address.phone')}
                    type="tel"
                    placeholder="+905551112233"
                    autoComplete="tel"
                    {...register('phoneE164')}
                    error={errors.phoneE164?.message}
                />
                <div className="w-full space-y-2">
                    <label htmlFor="address-note" className="text-sm font-medium leading-none text-zinc-700">
                        {t('address.note')} <span className="font-normal text-zinc-400">({t('address.optional')})</span>
                    </label>
                    <textarea
                        id="address-note"
                        rows={4}
                        maxLength={NOTE_MAX_LENGTH}
                        placeholder={t('address.notePlaceholder')}
                        aria-invalid={errors.note ? true : undefined}
                        {...register('note')}
                        className={`flex w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-200 ${errors.note ? 'border-red-500 focus-visible:ring-red-500' : 'border-zinc-300 focus-visible:ring-orange-500'}`}
                    />
                    {errors.note && <p role="alert" className="text-xs text-red-500 font-medium">{errors.note.message}</p>}
                </div>
            </div>
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
