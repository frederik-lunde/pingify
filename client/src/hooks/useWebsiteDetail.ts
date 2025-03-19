// src/hooks/useWebsiteDetail.ts
import { useState, useCallback } from 'react';
// Update import paths to use new structure
import { useWebsiteResults } from '../api/hooks/useMonitoring';
import { triggerWebsiteCheck } from '../api/monitoring';

export function useWebsiteDetail(websiteId: number) {
  const [isChecking, setIsChecking] = useState(false);
  const { 
    results, 
    loading, 
    error, 
    refetch 
  } = useWebsiteResults(websiteId, 50); 

  // Handle manual check button click
  const handleCheckNow = useCallback(async (): Promise<void> => {
    try {
      setIsChecking(true);
      await triggerWebsiteCheck(websiteId);
      // Immediately refetch results to show the new check
      await refetch();
    } catch (err) {
      console.error('Error triggering check:', err);
    } finally {
      setIsChecking(false);
    }
  }, [websiteId, refetch]);

  // Get current status from most recent result
  const latestResult = results && results.length > 0 ? results[0] : null;
  const currentStatus = latestResult?.isAvailable ? 'Online' : 'Offline';
  const statusColor: 'success' | 'error' | 'info' = latestResult?.isAvailable ? 'success' : 'error';

  return {
    results,
    loading,
    error,
    isChecking,
    handleCheckNow,
    latestResult,
    currentStatus,
    statusColor,
    refetch
  };
}