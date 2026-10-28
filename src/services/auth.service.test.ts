import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, authApi, postSessionRefresh } from '@/lib/axios';
import { setSignupBranchId } from '@/lib/signup-branch';
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

describe('authService sign-up branch', () => {
  const BRANCH_ID = '5a6c5004-acad-4444-888e-61a6f9f8016b';
  const headersOf = (call: unknown[]) => (call[2] as { headers?: Record<string, string> } | undefined)?.headers ?? {};

  beforeEach(() => {
    sessionStorage.clear();
    mockedApi.post.mockReset().mockResolvedValue({ data: { status: true, data: {} } });
    mockedAuthApi.post.mockReset().mockResolvedValue({ data: { status: true, data: { redirectUrl: 'https://accounts.example' } } });
  });

  it('sends the restaurant the visitor came from with an e-mail sign-up and a Google start', async () => {
    setSignupBranchId(BRANCH_ID);

    await authService.register({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', password: 'secret1' });
    await authService.registerWithOtp({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' });
    await authService.startGoogleLogin();

    expect(mockedApi.post.mock.calls.map((call) => [call[0], headersOf(call)])).toEqual([
      ['/auth/register', { 'x-branch-id': BRANCH_ID }],
      ['/auth/register', { 'x-branch-id': BRANCH_ID }],
    ]);
    const [url, body, config] = mockedAuthApi.post.mock.calls[0];
    expect([url, body, config]).toEqual([
      '/auth/login',
      { method: 'google', client: 'user' },
      { headers: { 'x-branch-id': BRANCH_ID } },
    ]);
  });

  it('sends no branch header at all when there is no restaurant', async () => {
    setSignupBranchId(null);

    await authService.register({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', password: 'secret1' });
    await authService.startGoogleLogin();

    expect(headersOf(mockedApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
    expect(headersOf(mockedAuthApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
    expect(headersOf(mockedAuthApi.post.mock.calls[0])).not.toHaveProperty('x-brand-id');
  });

  it.each(['', 'null', 'undefined', 'not-a-branch'])('never sends %j as the branch', async (value) => {
    sessionStorage.setItem('runmeal_signup_branch_id', value);

    await authService.startGoogleLogin();

    expect(headersOf(mockedAuthApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
  });

  it('does not send the branch with a password or code login', async () => {
    setSignupBranchId(BRANCH_ID);
    mockedApi.post.mockResolvedValue({ data: { status: true, data: { accessToken: 't', user } } });

    await authService.login({ email: 'ada@example.com', password: 'secret1' });
    await authService.requestOtpLogin('ada@example.com');

    mockedApi.post.mock.calls.forEach((call) => expect(headersOf(call)).not.toHaveProperty('x-branch-id'));
  });

  it('sends only the fields the API accepts, never a role', async () => {
    await authService.register({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'secret1',
      ...({ role: 'SUPER_ADMIN', latitude: '41' } as object),
    });

    expect(mockedApi.post.mock.calls[0][1]).toEqual({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'secret1',
    });
  });
});
