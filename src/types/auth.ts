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

export interface LoginDto {
  email: string;
  password: string;
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
