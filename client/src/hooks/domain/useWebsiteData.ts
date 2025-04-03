// src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";
import { UserWebsite, MonitoringResult, ApiError, OverallStats } from "../../types"; // Adjust path
import { useUserWebsitesQuery } from "../api/useWebsites";
import { useUserMonitoringResultsQuery } from "../api/useMonitoring"; // Hook to fetch all results
import { useUserStatsQuery } from "../api/useMonitoring"; // Hook to fetch user stats

// How many recent results to include for each website card
const RECENT_RESULTS_LIMIT_FOR_CARD = 20;

// Structure for combined data per website, including recent results
export interface WebsiteWithResults { // Renamed to reflect inclusion of results array
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  recentResults: MonitoringResult[]; // Added: Array of recent results for card charts/uptime
}

// Structure returned by the hook
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[]; // Updated property name
    overallStats: OverallStats | null;
    isLoading: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>;
}

/**
 * Hook to get combined website list, latest monitoring result, a limited set of recent results
 * for each website, and overall stats. Uses TanStack Query hooks.
 */
export function useWebsiteData(
    resultsLimit: number = 500, // Max results fetched overall
    statsPeriod: string = 'week',
    refetchInterval?: number | false
): WebsiteDataSummary {

    const queryConfig = useMemo(() => ({ refetchInterval }), [refetchInterval]);

    // 1. Fetch websites data
    const {
        data: userWebsites = [],
        isLoading: websitesLoading,
        error: websitesError,
        refetch: refetchWebsites,
    } = useUserWebsitesQuery(queryConfig);

    // 2. Fetch monitoring results data (up to the overall limit)
    const {
        data: allMonitoringResults = [],
        isLoading: resultsLoading,
        error: resultsError,
        refetch: refetchResults,
    } = useUserMonitoringResultsQuery(resultsLimit, queryConfig);

    // 3. Fetch overall stats
    const {
        data: overallStats,
        isLoading: statsLoading,
        error: statsError,
        refetch: refetchStats,
    } = useUserStatsQuery(statsPeriod, queryConfig);

    // 4. Combine websites with their LATEST and RECENT results
    const websitesWithResults = useMemo((): WebsiteWithResults[] => { // Renamed variable
        if (!userWebsites || userWebsites.length === 0) {
            return [];
        }

        // Group all results by websiteId for efficient processing
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        for (const result of allMonitoringResults) {
            if (!resultsByWebsite.has(result.websiteId)) {
                resultsByWebsite.set(result.websiteId, []);
            }
            resultsByWebsite.get(result.websiteId)?.push(result);
        }

        // Sort results within each group (newest first) and extract latest/recent
        const processedWebsites: WebsiteWithResults[] = [];
        for (const userWebsite of userWebsites) {
            const websiteId = userWebsite.websiteId;
            const siteResults = resultsByWebsite.get(websiteId) || [];

            if (siteResults.length > 0) {
                 // Sort site's results: newest first
                 siteResults.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

                 const latestResult = siteResults[0]; // Newest is the latest
                 // Take up to N most recent results for the card
                 const recentResults = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);

                 processedWebsites.push({
                    userWebsite,
                    latestResult,
                    recentResults, // Include the limited recent results
                 });

            } else {
                 // Website has no results in the fetched data
                 processedWebsites.push({
                    userWebsite,
                    latestResult: undefined,
                    recentResults: [], // Empty array if no results
                 });
            }
        }

        return processedWebsites;

    }, [userWebsites, allMonitoringResults]);

    // 5. Helper function to refetch all data sources
    const refetch = useCallback(async () => {
        await Promise.all([
            refetchWebsites(),
            refetchResults(),
            refetchStats(),
        ]);
    }, [refetchWebsites, refetchResults, refetchStats]);

    // 6. Consolidate loading and error states
    const isLoading = websitesLoading || resultsLoading || statsLoading;
    const error = websitesError || resultsError || statsError;

    return {
        websitesWithResults, // Updated property name
        overallStats: overallStats ?? null,
        isLoading,
        error,
        refetch,
    };
}