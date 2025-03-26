import apiClient from './client';
import { Alert, AlertStats, AlertType, AlertUser } from '../types';

/**
 * Get alerts for the user's websites
 */
export const getUserAlerts = async (
  limit = 50, 
  type?: AlertType, 
  from?: Date, 
  to?: Date,
  isResolved?: boolean
): Promise<Alert[]> => {
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get('/alerts/user', { params });
  return response.data;
};

/**
 * Get unread alerts for the user
 */
export const getUserUnreadAlerts = async (
  limit = 50, 
  type?: AlertType, 
  from?: Date, 
  to?: Date,
  isResolved?: boolean
): Promise<AlertUser[]> => {
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get('/alerts/user/unread', { params });
  return response.data;
};

/**
 * Mark an alert as read
 */
export const markAlertAsRead = async (alertId: number): Promise<void> => {
  await apiClient.post(`/alerts/user/read/${alertId}`);
};

/**
 * Mark all alerts as read
 */
export const markAllAlertsAsRead = async (): Promise<void> => {
  await apiClient.post('/alerts/user/read-all');
};

/**
 * Get alerts for a specific website
 */
export const getAlertsByWebsite = async (
  websiteId: number, 
  limit = 50, 
  type?: AlertType, 
  from?: Date, 
  to?: Date,
  isResolved?: boolean
): Promise<Alert[]> => {
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get(`/alerts/website/${websiteId}`, { params });
  return response.data;
};

/**
 * Get alert statistics for the user
 */
export const getUserAlertStats = async (days = 7): Promise<AlertStats> => {
  const response = await apiClient.get('/alerts/user/stats', {
    params: { days }
  });
  return response.data;
};