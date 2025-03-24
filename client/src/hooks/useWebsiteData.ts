// src/hooks/useWebsiteData.ts
import { useState, useEffect } from 'react';
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
  const { websites, loading: websitesLoading } = useWebsites();
  const { results, loading: resultsLoading } = useUserMonitoringResults(100);
  const [websitesData, setWebsitesData] = useState<WebsiteData[]>([]);
  
  // Process and organize the data
  useEffect(() => {
    if (!websitesLoading && !resultsLoading && websites.length > 0) {
      // Group results by website ID
      const resultsByWebsite: Record<number, MonitoringResult[]> = {};
      
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
    websitesData,
    loading,
  };
}

export default useWebsiteData;