'use client';

import {
  Map,
  MapMouseEvent,
  AdvancedMarker,
  useMapsLibrary,
  useMap
} from '@vis.gl/react-google-maps';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodedAddress {
  formatted_address: string;
  address_components: AddressComponent[];
}

interface LocationPickerProps {
  value?: Location;
  onChange: (location: Location) => void;
  onAddressSelect?: (address: GeocodedAddress) => void;
  searchQuery?: string;
  defaultCenter?: Location;
  className?: string;
}

const DEFAULT_CENTER = {
  latitude: 41.390205,
  longitude: 2.154007,
};

export function LocationPicker({
  value,
  onChange,
  onAddressSelect,
  searchQuery,
  defaultCenter = DEFAULT_CENTER,
  className
}: LocationPickerProps) {
  const [internalPosition, setInternalPosition] = useState<Location | null>(null);
  
  // Use a ref for onChange to keep it out of effect dependencies (avoid loops if unstable)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useMemo(() => geocodingLib ? new geocodingLib.Geocoder() : null, [geocodingLib]);
  const map = useMap(); // Get map instance

  const isControlled = value !== undefined;
  const position = isControlled ? value : internalPosition;

  // Effect to center map when position changes programmatically (e.g. from edit mode)
  useEffect(() => {
    if (map && position) {
      map.panTo({ lat: position.latitude, lng: position.longitude });
    }
  }, [map, position]);

  // Handle Forward Geocoding (Form -> Map)
  useEffect(() => {
      if (geocoder && searchQuery) {
          geocoder.geocode({ address: searchQuery }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                  const location = results[0].geometry.location;
                  const newPos = {
                      latitude: location.lat(),
                      longitude: location.lng()
                  };
                  onChangeRef.current(newPos);
                  // Map panning is now handled by the position effect above
              } else {
                  console.warn('Geocoding failed for query:', searchQuery, status);
              }
          });
      }
  }, [searchQuery, geocoder]);


  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const newPos = {
        latitude: e.detail.latLng.lat,
        longitude: e.detail.latLng.lng,
      };
      
      if (!isControlled) {
         setInternalPosition(newPos);
      }
      onChange(newPos);

      // Reverse Geocode
      if (geocoder && onAddressSelect) {
        geocoder.geocode({ location: e.detail.latLng }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            onAddressSelect({
                formatted_address: results[0].formatted_address,
                address_components: results[0].address_components as AddressComponent[]
            });
          } else {
            console.error('Geocoder failed due to: ' + status);
          }
        });
      }
    }
  }, [onChange, isControlled, geocoder, onAddressSelect]);

  // If position is null (neither prop nor internal set), default to defaultCenter for map view
  const center = (position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) 
      ? { lat: position.latitude, lng: position.longitude } 
      : { lat: defaultCenter!.latitude, lng: defaultCenter!.longitude };

  return (
    <div className={className} style={{ width: '100%', height: '300px', minHeight: '300px' }}>
        <Map
          defaultCenter={center}
          defaultZoom={15} // Increased zoom for better visibility
          mapId="DEMO_MAP_ID" 
          onClick={handleMapClick}
          disableDefaultUI={false}
          className="w-full h-full"
        >
          {position && (
            <AdvancedMarker
              position={{ lat: position.latitude, lng: position.longitude }}
            />
          )}
        </Map>
    </div>
  );
}
