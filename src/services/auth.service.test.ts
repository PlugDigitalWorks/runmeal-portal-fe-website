import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, authApi, postSessionRefresh } from '@/lib/axios';
import { authService } from './auth.service';

vi.mock('@/lib/axios', () => ({
  AUTH_CLIENT: 'user',
  api: { get: vi.fn(), post: vi.fn() },
  authApi: { post: vi.fn() },
  postSessionRefresh: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const mockedAuthApi = vi.mocked(authApi);
const mockedRefresh = vi.mocked(postSessionRefresh);

const user = { id: 'user-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };

describe('authService.completeGoogleLogin', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedAuthApi.post.mockReset();
    mockedRefresh.mockReset();
    Cookies.remove('accessToken');
    Cookies.remove('user');
  });

  it('exchanges the handoff code and stores the session like a normal login', async () => {
    mockedAuthApi.post.mockResolvedValue({
      data: { data: { accessToken: 'access-1', user, client: 'user' } },
    });

    const result = await authService.completeGoogleLogin('code-1');

    expect(mockedAuthApi.post).toHaveBeenCalledWith('/auth/google/exchange', { handoff: 'code-1' });
    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(result).toEqual(user);
    expect(Cookies.get('accessToken')).toBe('access-1');
    expect(JSON.parse(Cookies.get('user') ?? 'null')).toEqual(user);
  });

  it('sends one exchange when the same code is completed twice at once', async () => {
    mockedAuthApi.post.mockResolvedValue({
      data: { data: { accessToken: 'access-2', user, client: 'user' } },
    });

    await Promise.all([
      authService.completeGoogleLogin('code-2'),
      authService.completeGoogleLogin('code-2'),
    ]);

    expect(mockedAuthApi.post).toHaveBeenCalledTimes(1);
  });

  it('rejects with the API error when the code is invalid', async () => {
    const error = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401, data: { code: 'AUTH_GOOGLE_HANDOFF_INVALID' } },
    });
    mockedAuthApi.post.mockRejectedValue(error);

    await expect(authService.completeGoogleLogin('code-3')).rejects.toBe(error);
    expect(Cookies.get('accessToken')).toBeUndefined();
  });

  it('falls back to refreshing from cookies when no handoff code is returned', async () => {
    mockedRefresh.mockResolvedValue({ data: { data: { accessToken: 'access-4' } } } as Awaited<
      ReturnType<typeof postSessionRefresh>
    >);
    mockedApi.get.mockResolvedValue({ data: { data: user } });

    const result = await authService.completeGoogleLogin();

    expect(mockedAuthApi.post).not.toHaveBeenCalled();
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(mockedApi.get).toHaveBeenCalledWith('/profile');
    expect(result).toEqual(user);
  });
});
