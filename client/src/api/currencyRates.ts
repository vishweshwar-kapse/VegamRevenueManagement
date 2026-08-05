import apiClient from './client';
import { ApiResponse } from '@/types';

export interface RateRow {
  month: number; // 1–12
  year: number;
  rates: Record<string, number>; // currency code → value
}

export interface CurrencyRateGrid {
  _id: string;
  currencies: string[];
  rows: RateRow[];
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveGridPayload {
  currencies: string[];
  rows: RateRow[];
}

export const currencyRatesApi = {
  get: () =>
    apiClient.get<ApiResponse<CurrencyRateGrid>>('/currency-rates'),

  save: (payload: SaveGridPayload) =>
    apiClient.put<ApiResponse<CurrencyRateGrid>>('/currency-rates', payload),
};
