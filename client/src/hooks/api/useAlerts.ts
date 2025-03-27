// src/hooks/api/useAlerts.ts
import { useCallback } from 'react';
import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../../types';
import apiClient from '../../api/client';
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
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  isPollingPaused = false // New parameter to pause polling
) {
  const fetchUnreadAlerts = useCallback(async () => {
    const { limit = 50, type, from, to, isResolved } = options;
    const params: any = { limit };
    if (type) params.type = type;
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    if (isResolved !== undefined) params.isResolved = isResolved;
    
    // Ensure the API returns an array, even if empty
    const result = await apiClient.get<AlertUser[]>('/alerts/user/unread', { params });
    return result ?? []; // Default to empty array if API returns null/undefined
  }, [options]);

  const pollingEnabled = !isPollingPaused; 

  const { 
    data: unreadAlerts, 
    loading, 
    error, 
    refetch, 
    setData 
  } = usePolling<AlertUser[]>(fetchUnreadAlerts, { 
      pollingInterval,
      initialData: [], 
      enabled: pollingEnabled  
  });

  // Updated markAsRead: Uses setData, avoids refetch
  const markAsRead = useCallback(async (alertId: number) => {
    try {
      await apiClient.post<void>(`/alerts/user/read/${alertId}`);
      setData(currentAlerts => 
        (currentAlerts ?? []).filter(alertUser => alertUser.alert.id !== alertId)
      );
    } catch (err) {
      console.error(`Failed to mark alert ${alertId} as read:`, err);
      throw err; 
    }
  }, [setData]);

  const markAllAsRead = useCallback(async () => {
     try {
       await apiClient.post<void>('/alerts/user/read-all');
       setData([]); 
     } catch (err) {
       console.error('Failed to mark all alerts as read:', err);
       throw err; 
     }
  }, [setData]);

  return { 
    unreadAlerts: unreadAlerts ?? [], 
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

