// src/hooks/useWebsiteData.ts
import { useState, useEffect, useMemo } from 'react';
import { useUserMonitoringResults } from '../api/hooks/useMonitoring'; 
import { getUserWebsites } from '../api/websites';
import { UserWebsite, MonitoringResult } from '../types';

export interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
}

export function useWebsiteData() {
  const [userWebsites, setUserWebsites] = useState<UserWebsite[]>([]);
  const [loading, setLoading] = useState(true);
  const { results: allMonitoringResults, loading: resultsLoading } = useUserMonitoringResults(100);
  
  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        const data = await getUserWebsites();
        setUserWebsites(data || []);
      } catch (error) {
        console.error('Error fetching user websites:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWebsites();
    const intervalId = setInterval(fetchWebsites, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
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
    loading: loading || resultsLoading
  };
}