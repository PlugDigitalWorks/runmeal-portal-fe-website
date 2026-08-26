export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Envelope for endpoints that flatten pagination: `data` is the page itself and
 * `meta` sits beside it, rather than a `data.data` wrapper.
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  sid?: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  sid?: string;
}

export type AuthClient = 'user' | 'manager';
export type AuthMethod = 'password' | 'otp' | 'google';

export interface LoginDto {
  email?: string;
  password?: string;
  method?: AuthMethod;
  client?: AuthClient;
  recaptchaToken?: string;
}

export interface OtpRequestResponse {
  message: string;
  method?: 'otp';
}

export interface VerifyOtpDto {
  email: string;
  code: string;
}

export interface GoogleLoginStartResponse {
  method: 'google';
  redirectUrl: string;
}



export interface RegisterDto {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  country?: string;
  role?: string;
  latitude?: string;
  longitude?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}
