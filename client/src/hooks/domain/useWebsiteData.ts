// src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";
import { UserWebsite, MonitoringResult } from "../../types";
import { useUserMonitoringResults } from "../api/useMonitoring";
import { useWebsites } from "../api/useWebsites";

export interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  results: MonitoringResult[]; // Array of monitoring results for chart
}

/**
 * Hook to get combined website and monitoring result data
 * Uses the API hooks for data fetching
 */
export function useWebsiteData(limit = 100, pollingInterval?: number) {
  // Fetch websites data
  const {
    data: userWebsites = [],
    loading: websitesLoading,
    refetch: refetchWebsites,
  } = useWebsites(pollingInterval);

  // Fetch monitoring results data
  const {
    data: allMonitoringResults = [],
    loading: resultsLoading,
    refetch: refetchResults,
  } = useUserMonitoringResults({ limit }, pollingInterval);

  // Combine websites with their results
  const websitesWithLatestResults = useMemo(() => {
    // Debug output for data received
    console.log(
      `Processing data: ${userWebsites?.length || 0} websites, ${allMonitoringResults?.length || 0} results`,
    );

    if (!userWebsites?.length) {
      return [];
    }

    // Map each website to include its results
    return userWebsites.map((userWebsite) => {
      // Filter results for this specific website
      const websiteResults = (allMonitoringResults || [])
        .filter((result) => result.websiteId === userWebsite.websiteId)
        .sort(
          (a, b) =>
            new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
        );

      // Get the latest result (first after sorting)
      const latestResult =
        websiteResults.length > 0 ? websiteResults[0] : undefined;

      return {
        userWebsite,
        latestResult,
        results: websiteResults,
      };
    });
  }, [userWebsites, allMonitoringResults]);

  // Helper function to refetch all data
  const refetch = useCallback(() => {
    console.log("Refetching website data and results");
    refetchWebsites();
    refetchResults();
  }, [refetchWebsites, refetchResults]);

  // Calculate overall status
  const overallStatus = useMemo(() => {
    if (!websitesWithLatestResults.length) {
      return {
        totalWebsites: 0,
        onlineWebsites: 0,
        offlineWebsites: 0,
      };
    }

    const online = websitesWithLatestResults.filter(
      (site) => site.latestResult?.isAvailable,
    ).length;

    return {
      totalWebsites: websitesWithLatestResults.length,
      onlineWebsites: online,
      offlineWebsites: websitesWithLatestResults.length - online,
    };
  }, [websitesWithLatestResults]);

  return {
    websitesWithLatestResults,
    loading: websitesLoading || resultsLoading,
    refetch,
    overallStatus,
  };
}

export default useWebsiteData;
