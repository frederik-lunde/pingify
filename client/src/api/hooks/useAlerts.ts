// src/api/hooks/useAlerts.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from '../../types';
import { getUserAlerts, getAlertsByWebsite, getUserAlertStats } from '../alerts';
import { DEFAULT_POLLING_INTERVAL } from '../config';

/**
 * Hook for polling user's alerts
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

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlertsByWebsite(websiteId, limit, type, from, to);
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch alerts for website ID: ${websiteId}`));
      console.error(`Error fetching alerts for website ID: ${websiteId}`, err);
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

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Hook for getting alert statistics for the user
 */
export function useAlertStats(days = 7, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [stats, setStats] = useState<{
    totalAlerts: number;
    byType: Record<string, number>;
    byWebsite: Array<{ websiteId: number, websiteName: string, count: number }>;
  } | null>(null);
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
