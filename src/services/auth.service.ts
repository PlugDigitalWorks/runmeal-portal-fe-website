import { api, authApi, AUTH_CLIENT, postSessionRefresh } from '@/lib/axios';
import {
  LoginDto,
  RegisterDto,
  AuthResponse,
  User,
  ApiResponse,
  ResetPasswordDto,
  RefreshResponse,
  GoogleLoginStartResponse,
  OtpRequestResponse,
  VerifyOtpDto,
} from '@/types/auth';
import Cookies from 'js-cookie';
import { signupBranchHeaders } from '@/lib/signup-branch';

const unwrapAuthData = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
};

const persistAuthResponse = (data: AuthResponse) => {
  const { accessToken, refreshToken, sid, user } = data;

  Cookies.set('accessToken', accessToken);
  if (refreshToken) Cookies.set('refreshToken', refreshToken);
  if (sid) Cookies.set('sid', sid);
  
  if (user) {
    Cookies.set('user', JSON.stringify(user));
  } else {
    console.error('No user object found in login response');
  }
};

const persistRefreshResponse = (data: RefreshResponse) => {
  Cookies.set('accessToken', data.accessToken);
  if (data.refreshToken) Cookies.set('refreshToken', data.refreshToken);
  if (data.sid) Cookies.set('sid', data.sid);
};

const persistUser = (user: User) => {
  Cookies.set('user', JSON.stringify(user));
};

/**
 * A handoff code is single-use, so a second exchange for the same code (e.g.
 * React StrictMode running the callback effect twice) shares the first call
 * instead of failing with AUTH_GOOGLE_HANDOFF_INVALID.
 */
let pendingHandoff: { code: string; promise: Promise<AuthResponse> } | null = null;

const exchangeGoogleHandoff = (code: string): Promise<AuthResponse> => {
  if (pendingHandoff?.code === code) return pendingHandoff.promise;

  const promise = authApi
    .post<ApiResponse<AuthResponse> | AuthResponse>('/auth/google/exchange', { handoff: code })
    .then((response) => unwrapAuthData(response.data));
  pendingHandoff = { code, promise };
  return promise;
};

/**
 * The sign-up body the API accepts — anything else is a 400 VALIDATION_FAILED.
 * The branch goes as a header instead (`signupBranchHeaders`).
 */
const toRegisterBody = ({ email, firstName, lastName, password, country }: RegisterDto): RegisterDto => ({
  email,
  firstName,
  lastName,
  ...(password ? { password } : {}),
  ...(country ? { country } : {}),
});

const isSocialMethod = (method?: string) => method === 'google' || method === 'apple';

export const authService = {
  async register(data: RegisterDto) {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', toRegisterBody(data), {
      headers: signupBranchHeaders(),
    });
    return response.data.data;
  },

  async forgotPassword(email: string) {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await api.get<ApiResponse<{ message: string }>>(`/auth/verify-email`, {
        params: { token }
    });
    return response.data;
  },

  async resetPassword(data: ResetPasswordDto) {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
    return response.data;
  },

  async login(data: LoginDto) {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      ...data,
      method: data.method || 'password',
      client: data.client || AUTH_CLIENT,
    }, isSocialMethod(data.method) ? { headers: signupBranchHeaders() } : undefined);

    persistAuthResponse(response.data.data);

    return response.data.data;
  },

  async requestOtpLogin(email: string, recaptchaToken?: string) {
    const response = await api.post<ApiResponse<OtpRequestResponse> | OtpRequestResponse>('/auth/login', {
      email,
      method: 'otp',
      client: AUTH_CLIENT,
      ...(recaptchaToken ? { recaptchaToken } : {}),
    });
    return unwrapAuthData(response.data);
  },

  async registerWithOtp(data: Omit<RegisterDto, 'password'>) {
    const response = await api.post<ApiResponse<OtpRequestResponse> | OtpRequestResponse>(
      '/auth/register',
      toRegisterBody(data),
      { headers: signupBranchHeaders() },
    );
    return unwrapAuthData(response.data);
  },

  async verifyOtp(data: VerifyOtpDto) {
    const response = await api.post<ApiResponse<AuthResponse> | AuthResponse>('/auth/verify-otp', {
      ...data,
      client: AUTH_CLIENT,
    });
    const authResponse = unwrapAuthData(response.data);
    persistAuthResponse(authResponse);
    return authResponse;
  },

  /** A first Google sign-in opens the account, so the branch it came from goes along. */
  async startGoogleLogin() {
    const response = await authApi.post<ApiResponse<GoogleLoginStartResponse>>(
      '/auth/login',
      { method: 'google', client: AUTH_CLIENT },
      { headers: signupBranchHeaders() },
    );

    return response.data.data;
  },

  async refreshSessionFromCookies() {
    const response = await postSessionRefresh<ApiResponse<RefreshResponse>>();
    persistRefreshResponse(response.data.data);
    return response.data.data;
  },

  /**
   * Finishes a Google sign-in from the `handoff` code the API put on the
   * `/login` return URL. It goes through `authApi`, like `startGoogleLogin`,
   * whose response set the binding cookie this call needs.
   */
  async completeGoogleLogin(handoff?: string) {
    if (handoff) {
      const authResponse = await exchangeGoogleHandoff(handoff);
      persistAuthResponse(authResponse);
      return authResponse.user;
    }

    // Temporary: an API that predates the handoff exchange returns only
    // `auth=success` and leaves the refresh cookie itself. Remove once the
    // API with `/auth/google/exchange` is live everywhere.
    await this.refreshSessionFromCookies();
    const response = await api.get<ApiResponse<User>>('/profile');
    persistUser(response.data.data);
    return response.data.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      // Always cleanup locally
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      Cookies.remove('sid');
      Cookies.remove('refresh');
      Cookies.remove('user');
      window.location.href = '/login';
    }
  },

  getUser(): User | null {
    const userStr = Cookies.get('user');
    if (!userStr || userStr === 'undefined') return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('JSON Parse error', e);
      return null;
    }
  },
  
  isAuthenticated(): boolean {
      return !!Cookies.get('accessToken');
  }
};
