'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AddressSearch } from '@/components/ui/AddressSearch';
import { useLocationPicker, useSearchLocation } from '@/context/LocationContext';
import { cn } from '@/lib/utils';

/** The delivery address chip beside the header search; opens the picker. */
export function LocationChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { openPicker } = useLocationPicker();
  const location = useSearchLocation();

  const label =
    location.label ??
    (location.source === 'browser' ? t('location.currentLocation') : t('location.defaultCity'));

  return (
    <button
      type="button"
      onClick={openPicker}
      aria-label={t('location.chooseAddress')}
      title={label}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-200 hover:text-orange-600',
        className,
      )}
    >
      <MapPin className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
      <span className="truncate">{label}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
    </button>
  );
}

/** Choosing a delivery address: the search moved here from the header bar. */
export function AddressPickerDialog() {
  const { t } = useTranslation();
  const { isPickerOpen, closePicker } = useLocationPicker();

  return (
    <Dialog.Root open={isPickerOpen} onOpenChange={(open) => !open && closePicker()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-24 z-[61] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-zinc-900">{t('location.pickerTitle')}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500">
                {t('location.pickerDescription')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <AddressSearch onSelected={closePicker} autoFocus />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
