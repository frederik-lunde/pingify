// src/hooks/useWebsiteData.ts
import { useState, useEffect, useMemo } from 'react';
import { useWebsites } from '../api/hooks/useWebsites';
import { useUserMonitoringResults } from '../api/hooks/useMonitoring';
import { UserWebsite, MonitoringResult } from '../types';

interface WebsiteData {
  website: UserWebsite;
  results: MonitoringResult[];
  latestResult: MonitoringResult | null;
  isOnline: boolean;
  responseTime: number | null;
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
      
      results.forEach(result => {
        if (!resultsByWebsite[result.websiteId]) {
          resultsByWebsite[result.websiteId] = [];
        }
        resultsByWebsite[result.websiteId].push(result);
      });
      
      // Sort results by timestamp (newest first) for each website
      Object.keys(resultsByWebsite).forEach(id => {
        resultsByWebsite[Number(id)].sort((a, b) => 
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );
      });
      
      // Create combined data structure
      const data = websites.map(website => {
        const websiteResults = resultsByWebsite[website.websiteId] || [];
        const latestResult = websiteResults.length > 0 ? websiteResults[0] : null;
        
        return {
          website,
          results: websiteResults,
          latestResult,
          isOnline: latestResult ? latestResult.isAvailable : false,
          responseTime: latestResult ? latestResult.responseTime : null,
        };
      });
      
      setWebsitesData(data);
    }
  }, [websites, results, websitesLoading, resultsLoading]);
  
  const loading = websitesLoading || resultsLoading;
  
  return {

    websitesWithLatestResults,
    loading: websitesLoading || resultsLoading
  };
}

export default useWebsiteData;