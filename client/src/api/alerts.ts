// src/api/alerts.ts
import apiClient from './client';
import { Alert, AlertStats } from '../types';

/**
 * Get alerts for the user's websites (only from websites where alertEnabled = true)
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
 * Will only return alerts if the user has alertEnabled = true for this website
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
 * Only includes websites where the user has alertEnabled = true
 */
export const getUserAlertStats = async (days = 7): Promise<AlertStats> => {
  const response = await apiClient.get('/alerts/user/stats', {
    params: { days }
  });
  return response.data;
};