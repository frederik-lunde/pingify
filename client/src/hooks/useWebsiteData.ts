// src/hooks/useWebsiteData.ts
import { useMemo, useCallback } from 'react';
import { useUserMonitoringResults } from '../api/hooks/useMonitoring'; 
import { useWebsites } from '../api/hooks/useWebsites';
import { UserWebsite, MonitoringResult } from '../types';

export interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  results: MonitoringResult[]; // Added the results array for the chart
}

export function useWebsiteData() {
  const { 
    data: userWebsites = [], 
    loading: websitesLoading, 
    refetch: refetchWebsites 
  } = useWebsites();
  
  const { 
    data: allMonitoringResults = [], 
    loading: resultsLoading,
    refetch: refetchResults 
  } = useUserMonitoringResults(100);
  
  const websitesWithLatestResults = useMemo(() => {
    if (!userWebsites?.length) {
      return [];
    }
    
    return userWebsites.map(userWebsite => {
      // Filter monitoring results for this website
      const websiteResults = (allMonitoringResults ?? [])
        .filter(result => result.websiteId === userWebsite.websiteId)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
      
      // Get the latest result
      const latestResult = websiteResults.length > 0 ? websiteResults[0] : undefined;
      
      return {
        userWebsite,
        latestResult,
        results: websiteResults // Include all results for the chart
      };
    });
  }, [userWebsites, allMonitoringResults]);

  // Helper to refetch all data
  const refetch = useCallback(() => {
    refetchWebsites();
    refetchResults();
  }, [refetchWebsites, refetchResults]);

  return {
    websitesWithLatestResults,
    loading: websitesLoading || resultsLoading,
    refetch
  };
}