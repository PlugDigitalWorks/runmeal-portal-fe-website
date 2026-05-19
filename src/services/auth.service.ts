import { api } from '@/lib/axios';
import { LoginDto, RegisterDto, AuthResponse, User, ApiResponse, ResetPasswordDto } from '@/types/auth';
import Cookies from 'js-cookie';

export const authService = {
  async register(data: RegisterDto) {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
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
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);

    const { accessToken, refreshToken, sid, user } = response.data.data;

    // We use manual cookie management because we asked for tokens in body
    Cookies.set('accessToken', accessToken);
    if (refreshToken) Cookies.set('refreshToken', refreshToken);
    if (sid) Cookies.set('sid', sid);
    
    if (user) {
        Cookies.set('user', JSON.stringify(user));
    } else {
        console.error('No user object found in login response');
    }

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
