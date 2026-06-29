import apiClient from './client';
import { Invoice, InvoiceStatus, ApiResponse } from '@/types';

export interface InvoiceLineItemPayload {
  poId: string;
  description?: string;
  amount: number;
}

export interface CreateInvoicePayload {
  customerId: string;
  plantId?: string;
  invoiceDate: string;   // ISO date string
  payByDate: string;     // ISO date string
  lineItems: InvoiceLineItemPayload[];
  taxAmount?: number;
  taxDescription?: string;
  description?: string;
  notes?: string;
}

export interface InvoiceListParams {
  status?: InvoiceStatus;
  customerId?: string;
  poId?: string;
  page?: number;
  limit?: number;
}

export const invoicesApi = {
  list: (params?: InvoiceListParams) =>
    apiClient.get<ApiResponse<Invoice[]>>('/invoices', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  create: (payload: CreateInvoicePayload) =>
    apiClient.post<ApiResponse<Invoice>>('/invoices', payload),

  update: (id: string, payload: Partial<CreateInvoicePayload>) =>
    apiClient.put<ApiResponse<Invoice>>(`/invoices/${id}`, payload),

  issue: (id: string) =>
    apiClient.post<ApiResponse<Invoice>>(`/invoices/${id}/issue`),

  cancel: (id: string, remarks?: string) =>
    apiClient.post<ApiResponse<null>>(`/invoices/${id}/cancel`, { remarks }),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/invoices/${id}`),

  // Fetch the generated PDF as a blob (auth header is applied by the client interceptor).
  downloadPdf: (id: string) =>
    apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
};
