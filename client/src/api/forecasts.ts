import apiClient from './client';
import { Forecast, ForecastStatus, ForecastDistribution, ApiResponse, DashboardSummary } from '@/types';

export interface CreateForecastPayload {
  entityId?: string;
  customerId: string;
  plantId: string;
  description: string;
  fy: string;
  status?: ForecastStatus;
  distributions: ForecastDistribution[];
  notes?: string;
}

export interface ForecastListParams {
  fy?: string;
  status?: ForecastStatus;
  customerId?: string;
  plantId?: string;
  page?: number;
  limit?: number;
}

export const forecastsApi = {
  list: (params?: ForecastListParams) =>
    apiClient.get<ApiResponse<Forecast[]>>('/forecasts', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Forecast>>(`/forecasts/${id}`),

  create: (payload: CreateForecastPayload) =>
    apiClient.post<ApiResponse<Forecast>>('/forecasts', payload),

  update: (id: string, payload: Partial<CreateForecastPayload>) =>
    apiClient.put<ApiResponse<Forecast>>(`/forecasts/${id}`, payload),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/forecasts/${id}`),

  summary: (fy?: string) =>
    apiClient.get('/forecasts/summary', { params: fy ? { fy } : undefined }),
};

export const dashboardApi = {
  summary: (fy?: string) =>
    apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary', { params: fy ? { fy } : undefined }),
};
