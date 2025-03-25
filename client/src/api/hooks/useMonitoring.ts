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
import { usePolling } from '../../hooks/common';

export type TimeRange = '1h' | '12h' | '24h' | '7d' | '30d' | '90d';

/**
 * Hook for polling the latest monitoring results for the user's websites
 */

export function useUserMonitoringResults(limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchResults = useCallback(async () => {
    return await getUserResults(limit);
  }, [limit]);

  return usePolling<MonitoringResult[]>(fetchResults, { pollingInterval });
}

/**
 * Hook for polling results for a specific website with time range support
 */
export function useWebsiteResults(websiteId: number, limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchResults = useCallback(async () => {
    return await getResultsByWebsite(websiteId, limit);
  }, [websiteId, limit]);

  return usePolling<MonitoringResult[]>(fetchResults, { pollingInterval });
}

/**
 * Hook for polling user dashboard statistics
 */
export function useUserStats(period = '7d', pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchStats = useCallback(async () => {
    return await getUserStats(period);
  }, [period]);
  return usePolling<OverallStats>(fetchStats, { pollingInterval });
}

/**
 * Hook for polling statistics for a specific website
 */

export function useWebsiteStats(websiteId: number, period = '7d', pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const fetchStats = useCallback(async () => {
    return await getWebsiteStats(websiteId, period);
  }, [websiteId, period]);

  return usePolling<WebsiteStats>(fetchStats, { pollingInterval });
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