// src/api/alerts.ts
import apiClient from './client';
import { Alert } from '../types';

/**
 * Get all alerts
 */
export const getAlerts = async (limit = 10, active?: boolean): Promise<Alert[]> => {
  let url = `/alerts?limit=${limit}`;
  if (active !== undefined) {
    url += `&active=${active}`;
  }
  const response = await apiClient.get(url);
  return response.data;
};

/**
 * Get alerts for a specific website
 */
export const getWebsiteAlerts = async (websiteId: number, limit = 10): Promise<Alert[]> => {
  const response = await apiClient.get(`/alerts?websiteId=${websiteId}&limit=${limit}`);
  return response.data;
};

/**
 * Resolve an alert manually
 */
export const resolveAlert = async (alertId: number): Promise<Alert> => {
  const response = await apiClient.post(`/alerts/${alertId}/resolve`);
  return response.data;
};
