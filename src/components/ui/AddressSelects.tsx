'use client';

import { Country, State, City } from 'country-state-city';
import { Control, Controller, UseFormSetValue, FieldValues, FieldErrors, Path, PathValue } from 'react-hook-form';

export interface AddressLocationFields {
  countryCode: string;
  province: string;
  district: string;
}

interface AddressSelectsProps<T extends FieldValues & AddressLocationFields> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  currentCountry?: string;
  currentState?: string; 
  errors: FieldErrors<T>;
  className?: string;
  onLocationChange?: (lat: number, lng: number) => void;
}

export function AddressSelects<T extends FieldValues & AddressLocationFields>({ control, setValue, currentCountry, currentState, errors, className, onLocationChange }: AddressSelectsProps<T>) {
  const countries = Country.getAllCountries();
  
  const selectedCountryCode = currentCountry;
  const states = selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [];
  
  const selectedStateCode = states.find(s => s.name === currentState)?.isoCode;
  
  const cities = (selectedCountryCode && selectedStateCode) 
    ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) 
    : [];

  const getLabels = (countryCode?: string) => {
    if (countryCode === 'TR') {
       return { state: 'City (İl)', city: 'District (İlçe)' };
    }
    if (countryCode === 'US') {
       return { state: 'State', city: 'City' };
    }
    return { state: 'State / Province', city: 'City / District' };
  };

  const labels = getLabels(selectedCountryCode);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Country Select */}
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Country
        </label>
        <Controller
          name={"countryCode" as Path<T>}
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(e) => {
                field.onChange(e);
                setValue("province" as Path<T>, '' as PathValue<T, Path<T>>); 
                setValue("district" as Path<T>, '' as PathValue<T, Path<T>>); 
                
                // e.target.value is the ISO Code
                const c = countries.find(x => x.isoCode === e.target.value);
                if (c && c.latitude && c.longitude && onLocationChange) {
                    onLocationChange(Number(c.latitude), Number(c.longitude));
                }
              }}
            >
              <option value="">Select Country</option>
              {countries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        />
        {errors.countryCode && (
          <p className="text-xs font-medium text-red-500">{errors.countryCode?.message as string}</p>
        )}
      </div>

      {/* State/Province Select */}
       <div className="space-y-2">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {labels.state}
        </label>
        {states.length > 0 ? (
          <Controller
            name={"province" as Path<T>}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? ''}
                disabled={!currentCountry || states.length === 0}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(e) => {
                  field.onChange(e);
                  setValue("district" as Path<T>, '' as PathValue<T, Path<T>>);

                  const s = states.find(x => x.name === e.target.value);
                  if (s && s.latitude && s.longitude && onLocationChange) {
                     onLocationChange(Number(s.latitude), Number(s.longitude));
                  }
                }}
              >
                <option value="">Select {labels.state}</option>
                {states.map((s) => (
                  <option key={s.isoCode} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          />
        ) : (
           <Controller
             name={"province" as Path<T>}
             control={control}
             render={({field}) => (
                 <input 
                    {...field}
                    value={field.value ?? ''}
                    disabled={!currentCountry}
                    placeholder={`Enter ${labels.state}`}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                 />
             )}
            />
        )}
        {errors.province && (
          <p className="text-xs font-medium text-red-500">{errors.province?.message as string}</p>
        )}
      </div>
      
       {/* City/District Select */}
       <div className="space-y-2">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {labels.city}
        </label>
         {cities.length > 0 ? (
            <Controller
            name={"district" as Path<T>}
            control={control}
            render={({ field }) => (
                <select
                {...field}
                value={field.value ?? ''}
                disabled={!currentState}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(e) => {
                    field.onChange(e);
                     const c = cities.find(x => x.name === e.target.value);
                     if (c && c.latitude && c.longitude && onLocationChange) {
                        onLocationChange(Number(c.latitude), Number(c.longitude));
                     }
                }}
                >
                <option value="">Select {labels.city}</option>
                {cities.map((c) => (
                    <option key={c.name} value={c.name}>
                    {c.name}
                    </option>
                ))}
                </select>
            )}
            />
         ) : (
             <Controller
             name={"district" as Path<T>}
             control={control}
             render={({field}) => (
                 <input 
                    {...field}
                    value={field.value ?? ''}
                    disabled={!currentState}
                    placeholder={`Enter ${labels.city}`}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                 />
             )}
             />
         )}
        
        {errors.district && (
          <p className="text-xs font-medium text-red-500">{errors.district?.message as string}</p>
        )}
      </div>

    </div>
  );
}
