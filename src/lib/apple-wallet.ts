/**
 * Apple Wallet helpers for the stamp-card "Add to Apple Wallet" button.
 *
 * The frontend never builds a pass or a download link: the backend signs the
 * `.pkpass` and hands back a single-use URL. These helpers only decide how the
 * button should present itself on the current device and sanity-check the URL
 * before the browser is sent to it.
 */

/**
 * - `ios`: iPhone / iPod / iPad. Opening the `.pkpass` shows the Wallet preview
 *   with an "Add" button, and the pass receives the backend's push updates.
 * - `mac`: macOS. Safari can preview the pass, other browsers just download it;
 *   the button stays available but the UI points the customer to their iPhone.
 * - `unsupported`: everything else (Android, Windows, Linux). No Wallet app, so
 *   the button is not rendered at all.
 */
export type AppleWalletPlatform = 'ios' | 'mac' | 'unsupported';

export function detectAppleWalletPlatform(): AppleWalletPlatform {
  if (typeof navigator === 'undefined') return 'unsupported';

  const userAgent = navigator.userAgent || '';
  if (/iPhone|iPod|iPad/i.test(userAgent)) return 'ios';

  const isMacLike = /Macintosh|Mac OS X/i.test(userAgent);
  // iPadOS 13+ reports a desktop Mac user agent; touch support gives it away.
  if (isMacLike && navigator.maxTouchPoints > 1) return 'ios';
  if (isMacLike) return 'mac';

  return 'unsupported';
}

/**
 * Accepts only absolute http(s) URLs exactly as the API returned them. Anything
 * else (missing, relative, `javascript:`) is treated as a failed request rather
 * than navigated to.
 */
export function parseAppleWalletDownloadUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
