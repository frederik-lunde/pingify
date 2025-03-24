// src/api/hooks/useAlerts.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertStats } from '../../types';
import { getUserAlerts, getAlertsByWebsite, getUserAlertStats } from '../alerts';
import { DEFAULT_POLLING_INTERVAL } from '../config';

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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getUserAlerts(limit, type, from, to);
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alerts'));
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, type, from, to]);

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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [noAlertsEnabled, setNoAlertsEnabled] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlertsByWebsite(websiteId, limit, type, from, to);
      setAlerts(data);
      setNoAlertsEnabled(false);
      setError(null);
    } catch (err) {
      // If we get a 404, it likely means the user doesn't have access or alerts disabled
      if (err instanceof Error && err.message.includes('404')) {
        setNoAlertsEnabled(true);
        setAlerts([]);
      } else {
        setError(err instanceof Error ? err : new Error(`Failed to fetch alerts for website ID: ${websiteId}`));
        console.error(`Error fetching alerts for website ID: ${websiteId}`, err);
      }
    } finally {
      setLoading(false);
    }
  }, [websiteId, limit, type, from, to]);

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    // Set up polling
    const intervalId = setInterval(fetchAlerts, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchAlerts, pollingInterval]);

  return { alerts, loading, error, noAlertsEnabled, refetch: fetchAlerts };
}

/**
 * Hook for getting alert statistics for the user
 * Only includes websites where the user has alertEnabled = true
 */
export function useAlertStats(days = 7, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getUserAlertStats(days);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alert statistics'));
      console.error('Error fetching alert statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchStats, pollingInterval]);

  return { stats, loading, error, refetch: fetchStats };
}