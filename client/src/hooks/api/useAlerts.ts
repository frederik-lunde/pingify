// src/hooks/api/useAlerts.ts
import { useCallback } from 'react';
import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../../types';
import apiClient from '../../api/enhancedClient';
import { DEFAULT_POLLING_INTERVAL } from '../../api/config';
import { usePolling } from '../common/usePolling';

/**
 * Hook for polling user's alerts with improved parameter handling
 */
export function useUserAlerts(
  options: AlertQueryOptions = {}, 
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const fetchAlerts = useCallback(async () => {
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
    
    return await apiClient.get<Alert[]>('/alerts/user', { params });
  }, [options]);

  return usePolling<Alert[]>(fetchAlerts, { pollingInterval });
}

/**
 * Hook for polling unread alerts for the user with improved parameter handling
 */
export function useUserUnreadAlerts(
  options: AlertQueryOptions = {}, 
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const fetchUnreadAlerts = useCallback(async () => {
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
    
    return await apiClient.get<AlertUser[]>('/alerts/user/unread', { params });
  }, [options]);

  const { 
    data: unreadAlerts, 
    loading, 
    error, 
    refetch 
  } = usePolling<AlertUser[]>(fetchUnreadAlerts, { pollingInterval });

  // Add helper to mark as read and refetch
  const markAsRead = useCallback(async (alertId: number) => {
    await apiClient.post<void>(`/alerts/user/read/${alertId}`);
    refetch();
  }, [refetch]);

  // Add helper to mark all as read and refetch
  const markAllAsRead = useCallback(async () => {
    await apiClient.post<void>('/alerts/user/read-all');
    refetch();
  }, [refetch]);

  return { 
    unreadAlerts, 
    loading, 
    error, 
    refetch, 
    markAsRead, 
    markAllAsRead 
  };
}

/**
 * Hook for polling alerts for a specific website with improved parameter handling
 */
export function useWebsiteAlerts(
  websiteId: number, 
  options: AlertQueryOptions = {},
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const fetchAlerts = useCallback(async () => {
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
    
    return await apiClient.get<Alert[]>(`/alerts/website/${websiteId}`, { params });
  }, [websiteId, options]);

  return usePolling<Alert[]>(fetchAlerts, { pollingInterval });
}

/**
 * Hook for getting alert statistics for the user
 */
export function useAlertStats(days = 7, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchStats = useCallback(async () => {
    return await apiClient.get<AlertStats>('/alerts/user/stats', {
      params: { days }
    });
  }, [days]);

  return usePolling<AlertStats>(fetchStats, { pollingInterval });
}