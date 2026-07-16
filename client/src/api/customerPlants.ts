import apiClient from './client';
import { CustomerPlant, ContactPerson, ApiResponse } from '@/types';

export interface CreatePlantPayload {
  plantCode: string;
  plantName: string;
  customerId: string;
  isDefault?: boolean;
  country: string;
  city?: string;
  state?: string;
  region?: string;
  timezone: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstin?: string;
  vatNumber?: string;
  taxId?: string;
  currency?: string;
  creditPeriodDays?: number;
  contacts?: ContactPerson[];
  notes?: string;
}

export const customerPlantsApi = {
  listByCustomer: (customerId: string) =>
    apiClient.get<ApiResponse<CustomerPlant[]>>('/customer-plants', {
      params: { customerId, isActive: true },
    }),

  /** All active sites across every customer — used for bulk-upload code resolution. */
  listAll: () =>
    apiClient.get<ApiResponse<CustomerPlant[]>>('/customer-plants', {
      params: { isActive: true },
    }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<CustomerPlant>>(`/customer-plants/${id}`),

  create: (payload: CreatePlantPayload) =>
    apiClient.post<ApiResponse<CustomerPlant>>('/customer-plants', payload),

  update: (id: string, payload: Partial<CreatePlantPayload>) =>
    apiClient.put<ApiResponse<CustomerPlant>>(`/customer-plants/${id}`, payload),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/customer-plants/${id}`),
};
