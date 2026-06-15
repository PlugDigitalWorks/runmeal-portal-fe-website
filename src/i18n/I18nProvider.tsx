'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from './config';

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

  // Apply the user's preferred language only after hydration. Initial render
  // uses DEFAULT_LANGUAGE on both server and client (see config) so the
  // hydrated markup matches; detection (localStorage / navigator) runs here.
  useEffect(() => {
    const detected = i18n.services.languageDetector?.detect();
    const raw = Array.isArray(detected) ? detected[0] : detected;
    const lang = raw?.slice(0, 2) as SupportedLanguage | undefined;
    if (lang && SUPPORTED_LANGUAGES.includes(lang) && lang !== i18n.resolvedLanguage) {
      i18n.changeLanguage(lang);
    }
  }, []);

  if (!ready) return null;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
