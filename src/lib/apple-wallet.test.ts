import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectAppleWalletPlatform, parseAppleWalletDownloadUrl } from './apple-wallet';

const withNavigator = (userAgent: string, maxTouchPoints: number) => {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
};

describe('detectAppleWalletPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats iPhone and iPad user agents as iOS', () => {
    withNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Version/18.5 Mobile/15E148 Safari/604.1', 5);
    expect(detectAppleWalletPlatform()).toBe('ios');

    withNavigator('Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) Version/18.5 Mobile/15E148 Safari/604.1', 5);
    expect(detectAppleWalletPlatform()).toBe('ios');
  });

  it('recognises iPadOS behind a desktop Mac user agent by its touch screen', () => {
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.5 Safari/605.1.15', 5);
    expect(detectAppleWalletPlatform()).toBe('ios');
  });

  it('treats a Mac without touch as mac', () => {
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.5 Safari/605.1.15', 0);
    expect(detectAppleWalletPlatform()).toBe('mac');
  });

  it('treats Android and Windows as unsupported', () => {
    withNavigator('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/139.0 Mobile Safari/537.36', 5);
    expect(detectAppleWalletPlatform()).toBe('unsupported');

    withNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/139.0 Safari/537.36', 0);
    expect(detectAppleWalletPlatform()).toBe('unsupported');
  });

  it('is unsupported when there is no navigator (server render)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectAppleWalletPlatform()).toBe('unsupported');
  });
});

describe('parseAppleWalletDownloadUrl', () => {
  it('keeps absolute http(s) URLs as returned by the API', () => {
    const url = 'https://api.runmeal.com/apple-wallet/download/abc.pkpass';
    expect(parseAppleWalletDownloadUrl(url)).toBe(url);
    expect(parseAppleWalletDownloadUrl('http://localhost:3000/apple-wallet/download/abc.pkpass')).toBe(
      'http://localhost:3000/apple-wallet/download/abc.pkpass',
    );
  });

  it('rejects relative, non-http, empty and non-string values', () => {
    expect(parseAppleWalletDownloadUrl('/apple-wallet/download/abc.pkpass')).toBeNull();
    expect(parseAppleWalletDownloadUrl('javascript:alert(1)')).toBeNull();
    expect(parseAppleWalletDownloadUrl('')).toBeNull();
    expect(parseAppleWalletDownloadUrl(undefined)).toBeNull();
    expect(parseAppleWalletDownloadUrl(42)).toBeNull();
  });
});
