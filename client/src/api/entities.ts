import apiClient from './client';
import { Entity, ApiResponse } from '@/types';

export interface CreateEntityPayload {
  entityCode: string;
  name: string;
  legalName?: string;
  address?: string;
  country?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstin?: string;
  pan?: string;
  vatNumber?: string;
  taxId?: string;
  defaultCurrency: string;
  email?: string;
  phone?: string;
  website?: string;
  isDefault?: boolean;
}

export const entitiesApi = {
  list: () =>
    apiClient.get<ApiResponse<Entity[]>>('/entities'),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Entity>>(`/entities/${id}`),

  create: (payload: CreateEntityPayload) =>
    apiClient.post<ApiResponse<Entity>>('/entities', payload),

  update: (id: string, payload: Partial<CreateEntityPayload>) =>
    apiClient.put<ApiResponse<Entity>>(`/entities/${id}`, payload),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/entities/${id}`),
};
