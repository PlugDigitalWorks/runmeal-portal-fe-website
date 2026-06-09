'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './config';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // i18n is initialized synchronously at module import (see ./config).
  // Subscribe only to cover the rare case where it isn't ready yet.
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) return;
    const onInit = () => setReady(true);
    i18n.on('initialized', onInit);
    return () => i18n.off('initialized', onInit);
  }, []);

  if (!ready) return null;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
