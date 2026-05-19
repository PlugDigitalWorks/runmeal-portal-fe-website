'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function AddressSearch() {
  const [inputValue, setInputValue] = useState('');
  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { setTempAddress } = useUser();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const placesServiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
    // We need a dummy element for PlacesService if we want to use getDetails
    if (placesServiceRef.current) {
        placesService.current = new placesLib.PlacesService(placesServiceRef.current);
    }
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (!value.trim()) {
          setPredictions([]);
          setIsOpen(false);
          return;
      }

      if (autocompleteService.current) {
          autocompleteService.current.getPlacePredictions({
              input: value,
              componentRestrictions: { country: 'tr' }, // Restrict to Turkey
              types: ['geocode', 'establishment']
          }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                  setPredictions(results);
                  setIsOpen(true);
              } else {
                  setPredictions([]);
              }
          });
      }
  };

  const handleSelectPrediction = (placeId: string, description: string) => {
      if (!placesService.current) return;

      placesService.current.getDetails({
          placeId: placeId,
          fields: ['geometry', 'formatted_address']
      }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
              
              setTempAddress({
                  location: {
                      latitude: place.geometry.location.lat(),
                      longitude: place.geometry.location.lng()
                  },
                  formattedAddress: description // Use description or place.formatted_address
              });

              setInputValue(description);
              setIsOpen(false);
              router.push('/');
          }
      });
  };

  return (
    <div className="relative w-full max-w-md hidden md:block" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <Input 
            placeholder="Search for a delivery address..." 
            className="pl-9 bg-zinc-50/50 border-zinc-200 focus:bg-white transition-colors rounded-full"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue && setIsOpen(true)}
        />
      </div>

      {isOpen && predictions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-zinc-100 py-2 z-50 max-h-[300px] overflow-y-auto">
              {predictions.map((prediction) => (
                  <button
                      key={prediction.place_id}
                      className="w-full text-left px-4 py-2 hover:bg-zinc-50 flex items-start gap-3 transition-colors"
                      onClick={() => handleSelectPrediction(prediction.place_id, prediction.description)}
                  >
                      <MapPin className="h-4 w-4 text-zinc-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                              {prediction.structured_formatting.main_text}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                              {prediction.structured_formatting.secondary_text}
                          </p>
                      </div>
                  </button>
              ))}
              
              <div className="px-4 py-2 border-t border-zinc-100 mt-1">
                  <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-zinc-400">Powered by</span>
                      <span className="text-[10px] font-bold text-zinc-500">Google</span>
                  </div>
              </div>
          </div>
      )}
      
      {/* Hidden div for Places Service */}
      <div ref={placesServiceRef} />
    </div>
  );
}
