// src/api/hooks/useAlerts.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from '../../types';
import { getAlerts, getWebsiteAlerts, resolveAlert } from '../alerts';
import { DEFAULT_POLLING_INTERVAL } from '../config';

/**
 * Hook for polling alerts
 */
export function useAlerts(limit = 10, active?: boolean, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlerts(limit, active);
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alerts'));
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, active]);

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    // Set up polling
    const intervalId = setInterval(fetchAlerts, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchAlerts, pollingInterval]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Hook for polling alerts for a specific website
 */
export function useWebsiteAlerts(websiteId: number, limit = 10, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getWebsiteAlerts(websiteId, limit);
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch alerts for website ID: ${websiteId}`));
      console.error(`Error fetching alerts for website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, limit]);

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    // Set up polling
    const intervalId = setInterval(fetchAlerts, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchAlerts, pollingInterval]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Hook for resolving an alert
 */
export function useResolveAlert() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const resolve = useCallback(async (alertId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await resolveAlert(alertId);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(`Failed to resolve alert ID: ${alertId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  return { resolve, loading, error };
}
