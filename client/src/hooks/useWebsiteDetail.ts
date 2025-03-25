// src/hooks/useWebsiteDetail.ts
import { useState, useCallback } from 'react';
import { useWebsiteResults } from '../api/hooks/useMonitoring';
import { triggerWebsiteCheck } from '../api/monitoring';
import { useWebsite } from '../api/hooks/useWebsites';

export function useWebsiteDetail(websiteId: number) {
  const [isChecking, setIsChecking] = useState(false);
  
  const { 
    data: results = [], 
    loading: resultsLoading, 
    error: resultsError, 
    refetch: refetchResults,
    stopPolling: stopResultsPolling,
    startPolling: startResultsPolling
  } = useWebsiteResults(websiteId, 50);
  
  // Also fetch the user-specific website details
  const {
    data: userWebsite,
    loading: websiteLoading,
    error: websiteError,
    refetch: refetchWebsite,
    stopPolling: stopWebsitePolling,
    startPolling: startWebsitePolling
  } = useWebsite(websiteId);

  // Handle manual check button click
  const handleCheckNow = useCallback(async (): Promise<void> => {
    try {
      setIsChecking(true);
      await triggerWebsiteCheck(websiteId);
      // Immediately refetch results to show the new check
      await refetchResults();
    } catch (err) {
      console.error('Error triggering check:', err);
    } finally {
      setIsChecking(false);
    }
  }, [websiteId, refetchResults]);

  // Refetch all data
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

  // Get current status from most recent result
  const latestResult = results && results.length > 0 ? results[0] : null;
  const currentStatus = latestResult?.isAvailable ? 'Online' : 'Offline';
  const statusColor: 'success' | 'error' | 'info' = latestResult?.isAvailable ? 'success' : 'error';

  return {
    results,
    loading: resultsLoading || websiteLoading,
    error: resultsError || websiteError,
    isChecking,
    handleCheckNow,
    latestResult,
    currentStatus,
    statusColor,
    refetch: refetchAll,
    userWebsite,
    stopPolling,
    startPolling
  };
}