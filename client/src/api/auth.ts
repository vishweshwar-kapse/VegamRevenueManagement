import apiClient from './client';
import { User } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<LoginResponse>('/auth/login', payload),

  me: () =>
    apiClient.get<{ success: boolean; user: User }>('/auth/me'),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/auth/change-password', payload),

  forgotPassword: (email: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (payload: { email: string; otp: string; newPassword: string }) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', payload),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ success: boolean; data: { avatarUrl: string } }>(
      '/auth/profile/avatar',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  requestEmailOtp: (newEmail: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/profile/email/request-otp', { newEmail }),

  verifyEmailOtp: (otp: string) =>
    apiClient.post<{ success: boolean; data: { email: string }; message: string }>(
      '/auth/profile/email/verify-otp',
      { otp }
    ),
};
