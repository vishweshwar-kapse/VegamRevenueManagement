import apiClient from './client';
import { Customer, CostStructure, ContactPerson, PaginatedResponse, ApiResponse } from '@/types';

export interface CustomerListParams {
  search?: string;
  industry?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCustomerPayload {
  code: string;
  name: string;
  displayName?: string;
  industry?: string;
  parentGroup?: string;
  website?: string;
  pan?: string;
  defaultCurrency: string;
  defaultCreditPeriodDays: number;
  hqCountry?: string;
  hqCity?: string;
  notes?: string;
}

export const customersApi = {
  list: (params?: CustomerListParams) =>
    apiClient.get<PaginatedResponse<Customer>>('/customers', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Customer>>(`/customers/${id}`),

  create: (payload: CreateCustomerPayload) =>
    apiClient.post<ApiResponse<Customer>>('/customers', payload),

  update: (id: string, payload: Partial<CreateCustomerPayload>) =>
    apiClient.put<ApiResponse<Customer>>(`/customers/${id}`, payload),

  uploadContract: (id: string, file: File, remarks?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (remarks) form.append('remarks', remarks);
    return apiClient.post<ApiResponse<Customer['contractVersions']>>(
      `/customers/${id}/contract`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  saveCostStructure: (id: string, payload: CostStructure) =>
    apiClient.put<ApiResponse<CostStructure>>(`/customers/${id}/cost-structure`, payload),

  saveContacts: (id: string, contacts: ContactPerson[]) =>
    apiClient.put<ApiResponse<ContactPerson[]>>(`/customers/${id}/contacts`, { contacts }),
};
