// src/hooks/useWebsiteData.ts
import { useMemo } from 'react';
import { useUserMonitoringResults } from '../api/hooks/useMonitoring'; 
import { useWebsites } from '../api/hooks/useWebsites';
import { UserWebsite, MonitoringResult } from '../types';

export interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
}

export function useWebsiteData() {
  const { data: userWebsites = [], loading: websitesLoading } = useWebsites();
  const { data: allMonitoringResults = [], loading: resultsLoading } = useUserMonitoringResults(100);
  
  const websitesWithLatestResults = useMemo(() => {
    if (!userWebsites?.length || !allMonitoringResults?.length) {
      return [];
    }
    
    return userWebsites.map(userWebsite => {
      // Find the latest monitoring result for this website
      const latestResult = allMonitoringResults
        .filter(result => result.websiteId === userWebsite.websiteId)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
      
      return {
        userWebsite,
        latestResult
      };
    });
  }, [userWebsites, allMonitoringResults]);

  return {
    websitesWithLatestResults,
    loading: websitesLoading || resultsLoading
  };
}