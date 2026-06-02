export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
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

export interface GoogleLoginStartResponse {
  method: 'google';
  redirectUrl: string;
}



export interface RegisterDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
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
