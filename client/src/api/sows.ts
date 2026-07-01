import apiClient from './client';
import { SOW, SOWStatus, ApiResponse } from '@/types';

export interface SOWMilestonePayload {
  description: string;
  amount: number;
  deliveryDate: string; // ISO date string
}

export interface CreateSOWPayload {
  entityId?: string;
  customerId: string;
  plantId: string;
  title: string;
  description?: string;
  status?: SOWStatus;
  milestones: SOWMilestonePayload[];
  forecastId?: string;
  autoCreateForecast?: boolean;
  notes?: string;
}

export interface SOWListParams {
  status?: SOWStatus;
  customerId?: string;
  plantId?: string;
  page?: number;
  limit?: number;
}

export const sowsApi = {
  list: (params?: SOWListParams) =>
    apiClient.get<ApiResponse<SOW[]>>('/sows', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<SOW>>(`/sows/${id}`),

  create: (payload: CreateSOWPayload) =>
    apiClient.post<ApiResponse<SOW>>('/sows', payload),

  update: (id: string, payload: Partial<CreateSOWPayload>) =>
    apiClient.put<ApiResponse<SOW>>(`/sows/${id}`, payload),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/sows/${id}`),

  uploadDocument: (id: string, file: File, remarks?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (remarks) fd.append('remarks', remarks);
    return apiClient.post(`/sows/${id}/document`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
