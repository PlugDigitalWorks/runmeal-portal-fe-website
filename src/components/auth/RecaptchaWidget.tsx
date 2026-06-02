'use client';

import { useEffect, useRef, useState } from 'react';

import { getRecaptchaSiteKey, loadRecaptchaScript } from '@/lib/recaptcha';

interface RecaptchaWidgetProps {
  onTokenChange: (token: string | null) => void;
  resetKey?: string | number;
}

export function RecaptchaWidget({ onTokenChange, resetKey }: RecaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [loadError, setLoadError] = useState(false);
  const siteKey = getRecaptchaSiteKey();

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || widgetIdRef.current !== null) return;
        if (!window.grecaptcha?.render) {
          throw new Error('reCAPTCHA is not available.');
        }

        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            onTokenChangeRef.current(token);
            setLoadError(false);
          },
          'expired-callback': () => onTokenChangeRef.current(null),
          'error-callback': () => {
            onTokenChangeRef.current(null);
            setLoadError(true);
          },
        });
      })
      .catch((error) => {
        console.warn('[RecaptchaWidget] load failed', error);
        if (!cancelled) {
          onTokenChangeRef.current(null);
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    onTokenChangeRef.current(null);
    if (widgetIdRef.current !== null) {
      window.grecaptcha?.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div className="flex justify-center">
      <div className="min-h-[78px] w-[304px] max-w-full">
        <div ref={containerRef} />
        {loadError && (
          <p className="mt-2 text-center text-xs text-red-500">
            Security check could not be loaded.
          </p>
        )}
      </div>
    </div>
  );
}
