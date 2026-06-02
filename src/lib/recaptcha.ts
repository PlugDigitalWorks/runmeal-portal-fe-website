type RecaptchaRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type Grecaptcha = {
  render: (container: HTMLElement, options: RecaptchaRenderOptions) => number;
  reset: (widgetId?: number) => void;
  ready?: (callback: () => void) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const RECAPTCHA_SCRIPT_ID = 'runmeal-recaptcha-script';
const RECAPTCHA_SCRIPT_SOURCES = [
  'https://www.google.com/recaptcha/api.js?render=explicit',
  'https://www.recaptcha.net/recaptcha/api.js?render=explicit',
];

let recaptchaScriptPromise: Promise<void> | null = null;

export const getRecaptchaSiteKey = () => process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const waitForRecaptcha = () =>
  new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.grecaptcha?.render) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > 10000) {
        reject(new Error('reCAPTCHA is not available.'));
        return;
      }

      window.setTimeout(check, 80);
    };

    check();
  });

export const loadRecaptchaScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('reCAPTCHA can only run in the browser.'));
  }

  if (window.grecaptcha?.render) {
    return Promise.resolve();
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const loadSource = (sourceIndex: number) => {
      const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID);
      existingScript?.remove();

      const script = document.createElement('script');
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = RECAPTCHA_SCRIPT_SOURCES[sourceIndex];
      script.async = true;
      script.defer = true;
      script.onload = () => {
        waitForRecaptcha().then(resolve).catch(reject);
      };
      script.onerror = () => {
        const nextSourceIndex = sourceIndex + 1;
        if (nextSourceIndex < RECAPTCHA_SCRIPT_SOURCES.length) {
          loadSource(nextSourceIndex);
          return;
        }

        script.remove();
        recaptchaScriptPromise = null;
        reject(new Error('reCAPTCHA script failed to load.'));
      };
      document.head.appendChild(script);
    };

    loadSource(0);
  });

  return recaptchaScriptPromise;
};
