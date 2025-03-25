// src/api/hooks/useMonitoring.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { MonitoringResult, OverallStats, WebsiteStats } from '../../types';
import { 
  getUserResults, 
  getResultsByWebsite, 
  getUserStats, 
  getWebsiteStats,
  triggerWebsiteCheck
} from '../monitoring';

import { DEFAULT_POLLING_INTERVAL } from '../config';

export type TimeRange = '1h' | '12h' | '24h' | '7d' | '30d' | '90d';

/**
 * Hook for polling the latest monitoring results for the user's websites
 */
export function useUserMonitoringResults(
  options: {
    limit?: number;
    range?: TimeRange | { from?: Date; to?: Date };
    pollingInterval?: number;
  } = {}
) {
  const { limit = 20, range, pollingInterval = DEFAULT_POLLING_INTERVAL } = options;
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const data = await getUserResults(limit, range);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monitoring results'));
      console.error('Error fetching monitoring results:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, range]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling if interval > 0
    if (pollingInterval > 0) {
      const intervalId = setInterval(fetchResults, pollingInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchResults, pollingInterval]);

  // Calculate uptime based on actual results
  const uptime = useMemo(() => {
    if (!results || results.length === 0) return 1;
    const successful = results.filter(r => r.isAvailable).length;
    return successful / results.length;
  }, [results]);

  return { 
    results, 
    loading, 
    error, 
    uptime,
    refetch: fetchResults 
  };
}

/**
 * Hook for polling results for a specific website with time range support
 */
export function useWebsiteResults(
  websiteId: number, 
  options: {
    limit?: number;
    range?: TimeRange | { from?: Date; to?: Date };
    pollingInterval?: number;
  } = {}
) {
  const { limit = 20, range, pollingInterval = DEFAULT_POLLING_INTERVAL } = options;
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const data = await getResultsByWebsite(websiteId, limit, range);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch results for website ID: ${websiteId}`));
      console.error(`Error fetching results for website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, limit, range]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling if interval > 0
    if (pollingInterval > 0) {
      const intervalId = setInterval(fetchResults, pollingInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchResults, pollingInterval]);

  // Calculate uptime based on actual results
  const uptime = useMemo(() => {
    if (!results || results.length === 0) return 1;
    const successful = results.filter(r => r.isAvailable).length;
    return successful / results.length;
  }, [results]);

  return { 
    results, 
    loading, 
    error, 
    uptime,
    refetch: fetchResults 
  };
}

/**
 * Hook for polling user dashboard statistics
 */
export function useUserStats(
  options: {
    period?: TimeRange;
    pollingInterval?: number;
  } = {}
) {
  const { period = '7d', pollingInterval = DEFAULT_POLLING_INTERVAL } = options;
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getUserStats(period);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user statistics'));
      console.error('Error fetching user statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchStats, pollingInterval]);

  return { 
    stats, 
    loading, 
    error, 
    refetch: fetchStats 
  };
}

/**
 * Hook for polling statistics for a specific website
 */
export function useWebsiteStats(
  websiteId: number,
  options: {
    period?: TimeRange;
    pollingInterval?: number;
  } = {}
) {
  const { period = '7d', pollingInterval = DEFAULT_POLLING_INTERVAL } = options;
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getWebsiteStats(websiteId, period);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch stats for website ID: ${websiteId}`));
      console.error(`Error fetching stats for website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, period]);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchStats, pollingInterval]);

  return { 
    stats, 
    loading, 
    error, 
    refetch: fetchStats 
  };
}

/**
 * Hook for manually checking a website with loading state
 */
export function useWebsiteCheck() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<MonitoringResult | null>(null);

  const checkWebsite = useCallback(async (websiteId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await triggerWebsiteCheck(websiteId);
      if ('isAvailable' in data) { // Ensure data matches MonitoringResult structure
        if (
          data &&
          typeof data === 'object' &&
          'id' in data &&
          'websiteId' in data &&
          'checkedAt' in data &&
          'responseTime' in data &&
          'isAvailable' in data &&
          typeof data.id === 'number' &&
          typeof data.websiteId === 'number' &&
          typeof data.checkedAt === 'string' &&
          typeof data.responseTime === 'number' &&
          typeof data.isAvailable === 'boolean'
        ) {
          setResult({
            ...data,
            statusCode: ('statusCode' in data ? data.statusCode : 200), // Provide default or actual value
            errorMessage: ('errorMessage' in data ? (data as { errorMessage?: string }).errorMessage : null) // Provide default or actual value
          } as MonitoringResult);
        } else {
          throw new Error('Invalid response format from triggerWebsiteCheck');
        }
      } else {
        throw new Error('Invalid response format from triggerWebsiteCheck');
      }
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(`Failed to check website ID: ${websiteId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  return { 
    checkWebsite, 
    loading, 
    error, 
    result 
  };
}