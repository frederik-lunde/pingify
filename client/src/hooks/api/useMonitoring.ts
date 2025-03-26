// src/hooks/api/useMonitoring.ts
import { useState, useCallback } from 'react';
import { MonitoringResult, OverallStats, WebsiteStats } from '../../types';
import apiClient from '../../api/enhancedClient';
import { usePolling } from '../common/usePolling';

/**
 * Query options for monitoring results
 */
export interface MonitoringQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
}

/**
 * Hook for polling the latest monitoring results for the user's websites
 */
export function useUserMonitoringResults(
  options: MonitoringQueryOptions = { limit: 20 },
  pollingInterval?: number
) {
  const fetchResults = useCallback(async () => {
    const params: any = { limit: options.limit || 100 };
    if (options.from) params.from = options.from.toISOString();
    if (options.to) params.to = options.to.toISOString();
    
    return await apiClient.get<MonitoringResult[]>('/monitoring/user/results', { params });
  }, [options.limit, options.from, options.to]);

  return usePolling<MonitoringResult[]>(fetchResults, { pollingInterval });
}

/**
 * Hook for polling results for a specific website
 */
export function useWebsiteResults(
  websiteId: number, 
  options: MonitoringQueryOptions = { limit: 20 },
  pollingInterval?: number
) {
  const fetchResults = useCallback(async () => {
    const params: any = { limit: options.limit || 100 };
    if (options.from) params.from = options.from.toISOString();
    if (options.to) params.to = options.to.toISOString();
    
    return await apiClient.get<MonitoringResult[]>(
      `/monitoring/website/${websiteId}/results`, 
      { params }
    );
  }, [websiteId, options.limit, options.from, options.to]);

  return usePolling<MonitoringResult[]>(fetchResults, { pollingInterval });
}

/**
 * Hook for polling user dashboard statistics
 */
export function useUserStats(period = '7d', pollingInterval?: number) {
  const fetchStats = useCallback(async () => {
    return await apiClient.get<OverallStats>('/monitoring/user/stats', {
      params: { period }
    });
  }, [period]);

  return usePolling<OverallStats>(fetchStats, { pollingInterval });
}

/**
 * Hook for polling statistics for a specific website
 */
export function useWebsiteStats(websiteId: number, period = '7d', pollingInterval?: number) {
  const fetchStats = useCallback(async () => {
    return await apiClient.get<WebsiteStats>(`/monitoring/website/${websiteId}/stats`, {
      params: { period }
    });
  }, [websiteId, period]);

  return usePolling<WebsiteStats>(fetchStats, { pollingInterval });
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
      const data = await apiClient.post<{ message: string }>(`/monitoring/check/${websiteId}`);
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