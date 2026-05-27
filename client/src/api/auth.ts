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
};
