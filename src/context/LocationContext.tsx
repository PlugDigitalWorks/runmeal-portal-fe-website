'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useUser } from '@/context/UserContext';
import { formatAddressFirstLine } from '@/lib/address-lines';
import { browserLocationStore, type BrowserLocationState } from '@/lib/browser-location-store';
import { roundCoordinates, type Coordinates } from '@/lib/geo';

interface LocationContextType {
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

/** The address picker, opened from the header chip and the default-city banner. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // A visitor who already allowed (or blocked) location for this site is not
  // shown our prompt: use the answer the browser already has.
  useEffect(() => {
    if (browserLocationStore.getSnapshot().status !== 'unknown') return;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((permission) => {
        if (permission.state === 'granted') browserLocationStore.request();
        else if (permission.state === 'denied') browserLocationStore.decline();
      })
      .catch(() => {
        // No Permissions API: our prompt asks instead.
      });
  }, []);

  return (
    <LocationContext.Provider
      value={{ isPickerOpen, openPicker: () => setIsPickerOpen(true), closePicker: () => setIsPickerOpen(false) }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationPicker() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationPicker must be used within a LocationProvider');
  return context;
}

export function useBrowserLocation(): BrowserLocationState {
  return useSyncExternalStore(
    browserLocationStore.subscribe,
    browserLocationStore.getSnapshot,
    browserLocationStore.getServerSnapshot,
  );
}

export type SearchLocationSource = 'address' | 'saved' | 'browser';

export interface SearchLocation {
  /** Rounded to 3 decimals; `null` searches around the default city. */
  coords: Coordinates | null;
  source: SearchLocationSource | null;
  /** The chosen address, for the header; `null` for a browser position. */
  label: string | null;
  /** The visitor has not answered the location prompt yet. */
  shouldAskForLocation: boolean;
  /** Searching around the default city because no location is known. */
  isDefaultCity: boolean;
  /** False while the signed-in user's saved addresses are still loading. */
  isReady: boolean;
}

/**
 * Where restaurant search looks: an address the visitor picked, else a
 * signed-in user's active saved address, else the browser's position, else
 * the default city (no coordinates sent).
 */
export function useSearchLocation(): SearchLocation {
  const { user, addresses, tempAddress, isLoading } = useUser();
  const browser = useBrowserLocation();
  const saved = user ? addresses.find((address) => address.isActive) : undefined;

  let coords: Coordinates | null = null;
  let source: SearchLocationSource | null = null;
  let label: string | null = null;
  if (tempAddress) {
    coords = { lat: tempAddress.location.latitude, lng: tempAddress.location.longitude };
    source = 'address';
    label = tempAddress.formattedAddress || null;
  } else if (saved) {
    coords = { lat: saved.latitude, lng: saved.longitude };
    source = 'saved';
    label = formatAddressFirstLine(saved);
  } else if (browser.status === 'granted') {
    coords = browser.coords;
    source = 'browser';
  }

  return {
    coords: coords ? roundCoordinates(coords) : null,
    source,
    label,
    shouldAskForLocation: !isLoading && !coords && browser.status === 'unknown',
    isDefaultCity: !coords && browser.status === 'denied',
    isReady: !isLoading,
  };
}
