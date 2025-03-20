// src/api/hooks/useMonitoring.ts
import { useState, useEffect, useCallback } from 'react';
import { MonitoringResult, OverallStats } from '../../types';
import { getMonitoringResults, getWebsiteResults, getMonitoringStats, triggerWebsiteCheck } from '../monitoring';
import { DEFAULT_POLLING_INTERVAL } from '../config';

/**
 * Hook for polling the latest monitoring results
 */
export function useMonitoringResults(limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const data = await getMonitoringResults(limit);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monitoring results'));
      console.error('Error fetching monitoring results:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling
    const intervalId = setInterval(fetchResults, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchResults, pollingInterval]);

  return { results, loading, error, refetch: fetchResults };
}

/**
 * Hook for polling results for a specific website
 */
export function useWebsiteResults(websiteId: number, limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const data = await getWebsiteResults(websiteId, limit);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch results for website ID: ${websiteId}`));
      console.error(`Error fetching results for website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, limit]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling
    const intervalId = setInterval(fetchResults, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchResults, pollingInterval]);

  return { results, loading, error, refetch: fetchResults };
}

/**
 * Hook for polling website statistics
 */
export function useMonitoringStats(pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getMonitoringStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monitoring statistics'));
      console.error('Error fetching monitoring statistics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

/**
 * Hook for manually checking a website with loading state
 */
export function useWebsiteCheck() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<any>(null);

  const checkWebsite = useCallback(async (websiteId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await triggerWebsiteCheck(websiteId);
      setResult(data);
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(`Failed to check website ID: ${websiteId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  return { checkWebsite, loading, error, result };
}