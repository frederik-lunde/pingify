// src/api/hooks/useAlerts.ts
import { useState, useCallback } from 'react';
import { Alert, AlertStats } from '../../types';
import { getUserAlerts, getAlertsByWebsite, getUserAlertStats } from '../alerts';
import { DEFAULT_POLLING_INTERVAL } from '../config';
import { usePolling } from '../../hooks/common';

/**
 * Hook for polling user's alerts (only from websites where alertEnabled = true)
 */
export function useUserAlerts(
  limit = 50, 
  type?: string, 
  from?: Date, 
  to?: Date, 
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const fetchAlerts = useCallback(async () => {
    return await getUserAlerts(limit, type, from, to);
  }, [limit, type, from, to]);

  return usePolling<Alert[]>(fetchAlerts, { pollingInterval });
}

/**
 * Hook for polling alerts for a specific website
 * Will only return alerts if the user has alertEnabled = true for this website
 */
export function useWebsiteAlerts(
  websiteId: number, 
  limit = 50, 
  type?: string,
  from?: Date, 
  to?: Date,
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const [noAlertsEnabled, setNoAlertsEnabled] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlertsByWebsite(websiteId, limit, type, from, to);
      setNoAlertsEnabled(false);
      return data;
    } catch (err) {
      // If we get a 404, it likely means the user doesn't have access or alerts disabled
      if (err instanceof Error && err.message.includes('404')) {
        setNoAlertsEnabled(true);
        return [];
      }
      throw err;
    }
  }, [websiteId, limit, type, from, to]);

  const { data: alerts, loading, error, refetch } = usePolling<Alert[]>(fetchAlerts, { pollingInterval });

  return { alerts, loading, error, noAlertsEnabled, refetch };
}

/**
 * Hook for getting alert statistics for the user
 * Only includes websites where the user has alertEnabled = true
 */
export function useAlertStats(days = 7, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchStats = useCallback(async () => {
    return await getUserAlertStats(days);
  }, [days]);

  return usePolling<AlertStats>(fetchStats, { pollingInterval });
}