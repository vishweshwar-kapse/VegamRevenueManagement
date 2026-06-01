import apiClient from './client';
import { User, UserRole, ApiResponse } from '@/types';

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserAssignmentsPayload {
  assignedSites: string[];
  assignedCustomers: string[];
}

export const usersApi = {
  list: () =>
    apiClient.get<ApiResponse<User[]>>('/users'),

  create: (payload: CreateUserPayload) =>
    apiClient.post<ApiResponse<User>>('/users', payload),

  update: (id: string, payload: UpdateUserPayload) =>
    apiClient.put<ApiResponse<User>>(`/users/${id}`, payload),

  updateAssignments: (id: string, payload: UserAssignmentsPayload) =>
    apiClient.put<ApiResponse<User>>(`/users/${id}/assignments`, payload),

  resetPassword: (id: string, newPassword: string) =>
    apiClient.post<ApiResponse<null>>(`/users/${id}/reset-password`, { newPassword }),
};
