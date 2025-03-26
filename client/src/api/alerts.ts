import apiClient from './client';
import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../types';


/**
 * Get unread alerts for the user using options object
 */
export const getUserUnreadAlerts = async (
  options: AlertQueryOptions = {}
): Promise<AlertUser[]> => {
  const { 
    limit = 50, 
    type, 
    from, 
    to, 
    isResolved 
  } = options;
  
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get('/alerts/user/unread', { params });
  return response.data;
};

/**
 * Get alerts for the user's websites using options object
 */
export const getUserAlerts = async (
  options: AlertQueryOptions = {}
): Promise<Alert[]> => {
  const { 
    limit = 50, 
    type, 
    from, 
    to, 
    isResolved 
  } = options;
  
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get('/alerts/user', { params });
  return response.data;
};

/**
 * Get alerts for a specific website using options object
 */
export const getAlertsByWebsite = async (
  websiteId: number, 
  options: AlertQueryOptions = {}
): Promise<Alert[]> => {
  const { 
    limit = 50, 
    type, 
    from, 
    to, 
    isResolved 
  } = options;
  
  const params: any = { limit };
  if (type) params.type = type;
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  if (isResolved !== undefined) params.isResolved = isResolved;
  
  const response = await apiClient.get(`/alerts/website/${websiteId}`, { params });
  return response.data;
};

// These functions remain unchanged
export const markAlertAsRead = async (alertId: number): Promise<void> => {
  await apiClient.post(`/alerts/user/read/${alertId}`);
};

export const markAllAlertsAsRead = async (): Promise<void> => {
  await apiClient.post('/alerts/user/read-all');
};

export const getUserAlertStats = async (days = 7): Promise<AlertStats> => {
  const response = await apiClient.get('/alerts/user/stats', {
    params: { days }
  });
  return response.data;
};