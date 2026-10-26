import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, authApi } from './axios';

const answer = (config: InternalAxiosRequestConfig, status: number) => {
  if (status >= 400) {
    const response = { status, statusText: '', data: {}, headers: {}, config };
    return Promise.reject(new AxiosError('failed', String(status), config, null, response));
  }
  return Promise.resolve({ status, statusText: 'OK', data: { status: true, data: [] }, headers: {}, config });
};

describe('api client and signed-out browsing', () => {
  const originalLocation = window.location;
  let href = '';

  beforeEach(() => {
    href = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/', search: '', set href(value: string) { href = value; } },
    });
    vi.spyOn(authApi, 'post').mockRejectedValue(new Error('no session'));
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    Object.keys(Cookies.get()).forEach((name) => Cookies.remove(name));
    vi.restoreAllMocks();
  });

  it('sends no token when signed out', async () => {
    const seen: (string | undefined)[] = [];
    api.defaults.adapter = (config) => {
      seen.push(AxiosHeaders.from(config.headers).get('Authorization') as string | undefined);
      return answer(config, 200);
    };

    await api.get('/portal/branches/nearby');

    expect(seen).toEqual([undefined]);
  });

  it('retries a public read without an expired token instead of sending the visitor to sign in', async () => {
    Cookies.set('accessToken', 'expired');
    const seen: (string | undefined)[] = [];
    api.defaults.adapter = (config) => {
      const auth = AxiosHeaders.from(config.headers).get('Authorization') as string | undefined;
      seen.push(auth);
      return answer(config, auth ? 401 : 200);
    };

    await expect(api.get('/branches/b-1/menu')).resolves.toMatchObject({ status: 200 });

    expect(seen).toEqual(['Bearer expired', undefined]);
    expect(href).toBe('');
  });

  it('does not send a signed-out visitor to sign in when a request is refused', async () => {
    api.defaults.adapter = (config) => answer(config, 401);

    await expect(api.get('/branches/b-1')).rejects.toBeDefined();

    expect(href).toBe('');
  });
});
