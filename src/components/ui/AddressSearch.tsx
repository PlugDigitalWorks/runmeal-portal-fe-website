'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

type PlacesLibrary = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      includedRegionCodes: string[];
      sessionToken: unknown;
    }) => Promise<{ suggestions: PlaceSuggestion[] }>;
  };
};

type PlaceSuggestion = {
  placePrediction?: PlacePrediction | null;
};

type PlacePrediction = {
  placeId: string;
  mainText?: { toString: () => string } | null;
  secondaryText?: { toString: () => string } | null;
  text: { toString: () => string };
  toPlace: () => PlaceDetails;
};

type PlaceDetails = {
  location?: {
    lat: () => number;
    lng: () => number;
  } | null;
  formattedAddress?: string | null;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type AddressPrediction = {
  id: string;
  mainText: string;
  secondaryText: string;
  prediction: PlacePrediction;
};

export function AddressSearch() {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const placesLib = useMapsLibrary('places') as PlacesLibrary | null;
  const sessionTokenRef = useRef<unknown | null>(null);
  const requestIdRef = useRef(0);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { setTempAddress } = useUser();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!placesLib) return;
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
  }, [placesLib]);

  useEffect(() => {
     // Click outside handler
     const handleClickOutside = (event: MouseEvent) => {
         if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
             setIsOpen(false);
         }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNewPredictions = async (value: string) => {
      if (!placesLib?.AutocompleteSuggestion) return null;

      if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }

      const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value,
          includedRegionCodes: ['tr'],
          sessionToken: sessionTokenRef.current,
      });

      return suggestions
          .map((suggestion) => suggestion.placePrediction)
          .filter((prediction): prediction is PlacePrediction => Boolean(prediction))
          .map((prediction) => ({
              id: prediction.placeId,
              mainText: prediction.mainText?.toString() || prediction.text.toString(),
              secondaryText: prediction.secondaryText?.toString() || '',
              prediction,
          }));
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (!value.trim()) {
          setPredictions([]);
          setIsOpen(false);
          return;
      }

      const currentRequestId = ++requestIdRef.current;

      try {
          const nextPredictions = await fetchNewPredictions(value) ?? [];

          if (currentRequestId !== requestIdRef.current) return;

          setPredictions(nextPredictions);
          setIsOpen(nextPredictions.length > 0);
      } catch (error) {
          console.warn('Autocomplete suggestions failed', error);
          setPredictions([]);
          setIsOpen(false);
      }
  };

  const handleSelectPrediction = async (prediction: AddressPrediction) => {
      try {
          const place = prediction.prediction.toPlace();
          await place.fetchFields({ fields: ['location', 'formattedAddress'] });

          if (!place.location) return;

          const formattedAddress =
              place.formattedAddress ||
              prediction.prediction.text.toString();

          setTempAddress({
              location: {
                  latitude: place.location.lat(),
                  longitude: place.location.lng()
              },
              formattedAddress
          });

          setInputValue(formattedAddress);
          setPredictions([]);
          setIsOpen(false);
          sessionTokenRef.current = placesLib ? new placesLib.AutocompleteSessionToken() : null;
          router.push('/');
      } catch (error) {
          console.warn('Place details fetch failed', error);
      }
  };

  return (
    <div className="relative w-full max-w-md hidden md:block" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <Input 
            placeholder={t('common.searchAddress')}
            className="pl-9 bg-zinc-50/50 border-zinc-200 focus:bg-white transition-colors rounded-full"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
        />
      </div>

      {isOpen && predictions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-zinc-100 py-2 z-[9999] max-h-[300px] overflow-y-auto">
              {predictions.map((prediction) => (
                  <button
                      key={prediction.id}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-start gap-3 transition-colors border-b border-zinc-50 last:border-0"
                      onClick={() => handleSelectPrediction(prediction)}
                  >
                      <MapPin className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                              {prediction.mainText}
                          </p>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                              {prediction.secondaryText}
                          </p>
                      </div>
                  </button>
              ))}
              
              <div className="px-4 py-2 border-t border-zinc-100 mt-1 bg-zinc-50">
                  <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-zinc-400">Powered by</span>
                      <span className="text-[10px] font-bold text-zinc-500">Google</span>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
