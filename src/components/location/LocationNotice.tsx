'use client';

import { LocateFixed, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useBrowserLocation, useLocationPicker, type SearchLocation } from '@/context/LocationContext';
import { browserLocationStore } from '@/lib/browser-location-store';

/**
 * Above the restaurant list: asks once for the browser location (the list
 * already shows the default city meanwhile), and after a refusal says which
 * city is shown and offers the address picker.
 */
export function LocationNotice({ location }: { location: SearchLocation }) {
  const { t } = useTranslation();
  const { openPicker } = useLocationPicker();
  const browser = useBrowserLocation();

  if (location.shouldAskForLocation || browser.status === 'prompting') {
    return (
      <div
        role="region"
        aria-label={t('location.promptLabel')}
        className="mb-6 flex flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-start gap-2 text-sm text-orange-900">
          <LocateFixed className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('location.prompt')}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => browserLocationStore.decline()}>
            {t('location.notNow')}
          </Button>
          <Button
            size="sm"
            isLoading={browser.status === 'prompting'}
            onClick={() => browserLocationStore.request()}
          >
            {t('location.share')}
          </Button>
        </div>
      </div>
    );
  }

  if (location.isDefaultCity) {
    return (
      <div
        role="status"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-start gap-2 text-sm text-zinc-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
          {t('location.defaultCityBanner')}
        </p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={openPicker}>
          {t('location.chooseAddress')}
        </Button>
      </div>
    );
  }

  return null;
}
