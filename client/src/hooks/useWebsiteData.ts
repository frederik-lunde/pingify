// src/hooks/useWebsiteData.ts
import { useState, useEffect, useMemo } from 'react';
import { useMonitoringResults } from '../api/hooks/useMonitoring'; 
import { getWebsites } from '../api/websites';
import { Website, MonitoringResult } from '../types';

export interface WebsiteWithResult {
  website: Website;
  latestResult?: MonitoringResult;
}

export function useWebsiteData() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const { results: allMonitoringResults, loading: resultsLoading } = useMonitoringResults(100);
  
  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        const data = await getWebsites();
        setWebsites(data || []);
      } catch (error) {
        console.error('Error fetching websites:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWebsites();
    const intervalId = setInterval(fetchWebsites, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const websitesWithLatestResults = useMemo(() => {
    if (!websites?.length || !allMonitoringResults?.length) {
      return [];
    }
    
    return websites.map(website => {
      // Find the latest monitoring result for this website
      const latestResult = allMonitoringResults
        .filter(result => result.websiteId === website.id)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
      
      return {
        website,
        latestResult
      };
    });
  }, [websites, allMonitoringResults]);

  return {
    websitesWithLatestResults,
    loading: loading || resultsLoading
  };
}