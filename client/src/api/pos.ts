import apiClient from './client';
import { PO, POStatus, ApiResponse } from '@/types';

export interface POAllocationPayload {
  sowId: string;
  amount: number;
}

export interface CreatePOPayload {
  poNumber: string;
  customerId: string;
  plantId?: string;
  poDate: string;        // ISO date string
  poValue: number;
  allocations: POAllocationPayload[];
  milestones?: string;
  notes?: string;
}

export interface UpdatePOPayload extends Partial<CreatePOPayload> {
  status?: POStatus;
}

export interface POListParams {
  status?: POStatus;
  customerId?: string;
  sowId?: string;
  page?: number;
  limit?: number;
}

export const posApi = {
  list: (params?: POListParams) =>
    apiClient.get<ApiResponse<PO[]>>('/pos', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<PO>>(`/pos/${id}`),

  create: (payload: CreatePOPayload) =>
    apiClient.post<ApiResponse<PO>>('/pos', payload),

  update: (id: string, payload: UpdatePOPayload) =>
    apiClient.put<ApiResponse<PO>>(`/pos/${id}`, payload),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/pos/${id}`),

  // Upload one or more documents in a single request.
  uploadDocuments: (id: string, files: File[], remarks?: string) => {
    const fd = new FormData();
    files.forEach((file) => fd.append('files', file));
    if (remarks) fd.append('remarks', remarks);
    return apiClient.post(`/pos/${id}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
