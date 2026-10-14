'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import { ReactNode } from 'react';

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <>{children}</>; 
  }

  return (
    // English so geocoder names match the country-state-city dataset used by the address form.
    <APIProvider apiKey={apiKey} language="en" libraries={['places', 'geocoding']}>
      {children}
    </APIProvider>
  );
}
