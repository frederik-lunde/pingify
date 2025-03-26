// src/hooks/useWebsiteData.ts
import { useMemo, useCallback } from 'react';
import { useUserMonitoringResults } from '../api/hooks/useMonitoring'; 
import { useWebsites } from '../api/hooks/useWebsites';
import { UserWebsite, MonitoringResult } from '../types';

export interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  results: MonitoringResult[]; // Array of monitoring results for chart
}

/**
 * Hook to get combined website and monitoring result data
 * Simplified version with direct data processing
 */
export function useWebsiteData() {
  // Fetch websites data
  const { 
    data: userWebsites = [], 
    loading: websitesLoading, 
    refetch: refetchWebsites 
  } = useWebsites();
  
  // Fetch monitoring results data
  const { 
    data: allMonitoringResults = [], 
    loading: resultsLoading,
    refetch: refetchResults 
  } = useUserMonitoringResults(100);
  
  // Combine websites with their results
  const websitesWithLatestResults = useMemo(() => {
    // Debug output for data received
    console.log(`Processing data: ${userWebsites?.length || 0} websites, ${allMonitoringResults?.length || 0} results`);
    
    if (!userWebsites?.length) {
      return [];
    }
    
    // Map each website to include its results
    return userWebsites.map(userWebsite => {
      // Filter results for this specific website
      const websiteResults = (allMonitoringResults || [])
        .filter(result => result.websiteId === userWebsite.websiteId)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
      
      // Get the latest result (first after sorting)
      const latestResult = websiteResults.length > 0 ? websiteResults[0] : undefined;
      
      // Debug output for each website
      console.log(`Website ${userWebsite.name} (ID: ${userWebsite.websiteId}): ${websiteResults.length} results, latest:`, 
                  latestResult ? `${latestResult.responseTime}ms` : 'N/A');
      
      return {
        userWebsite,
        latestResult,
        results: websiteResults
      };
    });
  }, [userWebsites, allMonitoringResults]);

  // Helper function to refetch all data
  const refetch = useCallback(() => {
    console.log('Refetching website data and results');
    refetchWebsites();
    refetchResults();
  }, [refetchWebsites, refetchResults]);

  return {
    websitesWithLatestResults,
    loading: websitesLoading || resultsLoading,
    refetch
  };
}

export default useWebsiteData;