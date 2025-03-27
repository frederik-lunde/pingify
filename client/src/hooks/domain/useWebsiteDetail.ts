// src/hooks/domain/useWebsiteDetail.ts
import { useState, useCallback, useMemo } from 'react';
import { useWebsiteResults } from '../api/useMonitoring';
import { useWebsite } from '../api/useWebsites';
import { useWebsiteCheck } from '../api/useMonitoring';
import { DEFAULT_POLLING_INTERVAL } from '../../api/config';

/**
 * Hook that combines data for a specific website detail view
 */
export function useWebsiteDetail(
  websiteId: number, 
  resultsLimit = 50,
  pollingInterval = DEFAULT_POLLING_INTERVAL
) {
  // Track manual check status
  const [isCheckingManually, setIsCheckingManually] = useState(false);
  
  // Get website details with the API hook
  const { 
    data: userWebsite,
    loading: websiteLoading,
    error: websiteError,
    refetch: refetchWebsite,
    stopPolling: stopWebsitePolling,
    startPolling: startWebsitePolling
  } = useWebsite(websiteId, pollingInterval);

  // Get results with the API hook  
  const { 
    data: results = [], 
    loading: resultsLoading, 
    error: resultsError, 
    refetch: refetchResults,
    stopPolling: stopResultsPolling,
    startPolling: startResultsPolling
  } = useWebsiteResults(websiteId, { limit: resultsLimit }, pollingInterval);
  
  // Get manual check capability
  const { 
    checkWebsite, 
    loading: checkLoading 
  } = useWebsiteCheck();

  // Compute if we're in any loading state
  const isLoading = websiteLoading || resultsLoading;
  
  // Compute overall error (if any)
  const error = websiteError || resultsError;

  // Derive latest result state
  const latestResult = useMemo(() => (
    results && results.length > 0 ? results[0] : null
  ), [results]);

  // Derive current status
  const currentStatus = useMemo(() => {
    if (!latestResult) return 'Unknown';
    return latestResult.isAvailable ? 'Online' : 'Offline';
  }, [latestResult]);

  // Determine status color for UI
  const statusColor = useMemo((): 'success' | 'error' | 'info' => {
    if (!latestResult) return 'info';
    return latestResult.isAvailable ? 'success' : 'error';
  }, [latestResult]);

  // Handle manual check button click
  const handleCheckNow = useCallback(async (): Promise<void> => {
    if (isCheckingManually || !websiteId) return;

    try {
      setIsCheckingManually(true);
      await checkWebsite(websiteId);
      // Immediately refetch results to show the new check
      await refetchResults();
    } catch (err) {
      console.error('Error triggering check:', err);
    } finally {
      setIsCheckingManually(false);
    }
  }, [websiteId, checkWebsite, refetchResults, isCheckingManually]);

  // Combined refetch function
  const refetchAll = useCallback(async () => {
    await Promise.all([refetchResults(), refetchWebsite()]);
  }, [refetchResults, refetchWebsite]);

  // Stop all polling
  const stopPolling = useCallback(() => {
    stopResultsPolling();
    stopWebsitePolling();
  }, [stopResultsPolling, stopWebsitePolling]);

  // Start all polling
  const startPolling = useCallback(() => {
    startResultsPolling();
    startWebsitePolling();
  }, [startResultsPolling, startWebsitePolling]);

  // Calculate uptime percentage
  const uptime = useMemo(() => {
    if (!results || results.length === 0) return 100;
    const available = results.filter(r => r.isAvailable).length;
    return (available / results.length) * 100;
  }, [results]);

  // Calculate average response time
  const avgResponseTime = useMemo(() => {
    if (!results || results.length === 0) return 0;
    const validTimes = results
      .filter(r => r.responseTime !== null && r.responseTime !== undefined)
      .map(r => r.responseTime!);
    
    if (validTimes.length === 0) return 0;
    
    const sum = validTimes.reduce((acc, time) => acc + time, 0);
    return sum / validTimes.length;
  }, [results]);

  return {
    // Basic data
    userWebsite,
    results,
    latestResult,
    
    // Status information
    currentStatus,
    statusColor,
    uptime,
    avgResponseTime,
    
    // Loading and error states
    loading: isLoading,
    isChecking: isCheckingManually || checkLoading,
    error,
    
    // Actions
    handleCheckNow,
    refetch: refetchAll,
    stopPolling,
    startPolling
  };
}

export default useWebsiteDetail;