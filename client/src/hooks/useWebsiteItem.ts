// src/hooks/useWebsiteItem.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { UserWebsite, MonitoringResult } from '../types';
import { getResultsByWebsite } from '../api/monitoring';
import { DEFAULT_POLLING_INTERVAL } from '../api/config';

/**
 * Custom hook to fetch and manage data for a single website
 * This follows the pattern used in WebsiteDetails which works correctly
 */
export function useWebsiteItem(
  userWebsite: UserWebsite,
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [latestResult, setLatestResult] = useState<MonitoringResult | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Use refs to avoid recreating interval on every render
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const websiteIdRef = useRef<number>(userWebsite.websiteId);
  
  // Always update the ref if the websiteId changes
  useEffect(() => {
    websiteIdRef.current = userWebsite.websiteId;
  }, [userWebsite.websiteId]);
  
  // Fetch results for this website
  const fetchResults = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      // Use the correct method - the issue might be here
      const data = await getResultsByWebsite(websiteIdRef.current, 20);
      
      if (mountedRef.current) {
        // Sort results by date, most recent first
        const sortedData = [...data].sort(
          (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );
        
        setResults(sortedData);
        setLatestResult(sortedData.length > 0 ? sortedData[0] : undefined);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching website results:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch website results'));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);
  
  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchResults();
    
    // Set up interval
    intervalRef.current = window.setInterval(fetchResults, pollingInterval);
    
    // Cleanup
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchResults, pollingInterval]);
  
  // Debug output
  useEffect(() => {
    console.log(`[${userWebsite.name}] Results:`, results.length, 'Latest:', latestResult?.responseTime);
  }, [results, latestResult, userWebsite.name]);
  
  return {
    userWebsite,
    results,
    latestResult,
    loading,
    error,
    refetch: fetchResults
  };
}

export default useWebsiteItem;