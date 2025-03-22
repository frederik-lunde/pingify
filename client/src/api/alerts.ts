// src/api/alerts.ts
import apiClient from './client';
import { Alert } from '../types';

/**
 * Get alerts for the user's websites
 */
export const getUserAlerts = async (
  limit = 50, 
  type?: string, 
  from?: Date, 
  to?: Date
): Promise<Alert[]> => {
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  
  const response = await apiClient.get('/alerts/user', { params });
  return response.data;
};

/**
 * Get alerts for a specific website
 */
export const getAlertsByWebsite = async (
  websiteId: number, 
  limit = 50, 
  type?: string, 
  from?: Date, 
  to?: Date
): Promise<Alert[]> => {
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  
  const response = await apiClient.get(`/alerts/website/${websiteId}`, { params });
  return response.data;
};

/**
 * Get alert statistics for the user
 */
export const getUserAlertStats = async (days = 7): Promise<{
  totalAlerts: number;
  byType: Record<string, number>;
  byWebsite: Array<{ websiteId: number, websiteName: string, count: number }>;
}> => {
  const response = await apiClient.get('/alerts/user/stats', {
    params: { days }
  });
  return response.data;
};
