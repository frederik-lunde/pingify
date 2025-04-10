// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";

import {
    WebsiteUser,
    ApiError,
    OverallStats
} from "../../types"; // Adjust path if needed
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
// Remove useUserMonitoringResultsQuery import
import { useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path



// Interface for the combined data structure for each website card
// Simplified: The WebsiteUser object fetched now contains most required data
export interface WebsiteWithResults {
    userWebsite: WebsiteUser; // Contains all WebsiteUser fields including nested data
}

// Interface for the hook's return value (remains the same structure)
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[];
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>;
    totalWebsitesCount: number;
    upWebsitesCount: number;
    incidentsLast24h: number | null;
    lastIncidentTimestamp: string | null | undefined;
    lastIncidentWebsiteId: number | null | undefined;
}

/**
 * Custom hook to fetch and combine website list (now including results/chart data) and overall stats.
 */
export function useWebsiteData(
    // resultsLimit is no longer needed here
    statsPeriod: string = 'week', // Period for overall stats (e.g., 'day', 'week', 'month')
    refetchInterval?: number | false // Optional auto-refetch interval in ms
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({
        refetchInterval,
        staleTime: refetchInterval ? refetchInterval / 2 : 5 * 60 * 1000,
    }), [refetchInterval]);

    // --- TanStack Queries ---
    // Fetch user's website list (WebsiteUser objects, now including latestResult, chartData, uptimePercent)
    const websitesQuery = useUserWebsitesQuery(queryOptions);

    // REMOVED: resultsQuery = useUserMonitoringResultsQuery(...)

    // Fetch overall stats (OverallStats object including lastIncidentWebsiteId)
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    // isLoading depends only on websites and stats now
    const isLoading = websitesQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    // isFetching depends only on websites and stats now
    const isFetching = websitesQuery.isFetching || statsQuery.isFetching;
    // Combine errors
    // REMOVED: resultsQuery.error
    const errors: (ApiError | null)[] = [websitesQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data ---
    // Simplified: Just map the userWebsite data directly
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        // Guard clause: Ensure websitesQuery data is available
        // REMOVED: !resultsQuery.isSuccess || !resultsQuery.data
        if (!websitesQuery.isSuccess || !websitesQuery.data) {
            return [];
        }
        const userWebsites: WebsiteUser[] = websitesQuery.data;

        // Map directly, as userWebsite now contains the necessary data
        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => {
            // The fetched userWebsite object already has latestResult, chartData, uptimePercent, etc.
            return {
                 userWebsite
            };
        });

        // Note: Sorting is handled in the Dashboard component
        return newProcessedWebsites;

    // REMOVED: resultsQuery.isSuccess, resultsQuery.data
    }, [websitesQuery.isSuccess, websitesQuery.data]); // Dependencies for memoization


    // --- Calculate Aggregate Counts ---
    // Memoize counts based on the processed website list
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = processedWebsitesWithResults.length;
        // Count 'up' websites based on the latest result embedded in userWebsite
        const up = processedWebsitesWithResults.reduce((count, item) => {
            // Access latestResult directly from the userWebsite object
            if (item.userWebsite.latestResult?.isAvailable === true) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [processedWebsitesWithResults]); // Dependencies for memoization


    // --- Extract Specific Data from Overall Stats Query ---
    const { incidentsLast24h, lastIncidentTimestamp, lastIncidentWebsiteId } = useMemo(() => {
        const stats = statsQuery.data;
        return {
             incidentsLast24h: stats?.incidentsLast24h ?? null,
             lastIncidentTimestamp: stats?.lastIncidentTimestamp ?? null,
             lastIncidentWebsiteId: stats?.lastIncidentWebsiteId ?? null
        };
    }, [statsQuery.data]);

    // --- Refetch Function ---
    const refetch = useCallback(async () => {
        console.log('[useWebsiteData] Triggering refetch for dashboard queries...');
        // Trigger refetch for remaining queries
        const results = await Promise.allSettled([
            websitesQuery.refetch(),
            // REMOVED: resultsQuery.refetch(),
            statsQuery.refetch(),
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[useWebsiteData] Refetch failed for query index ${index}:`, result.reason);
            }
        });
        return results;
    // REMOVED: resultsQuery from dependencies
    }, [websitesQuery, statsQuery]);


    // --- Return Value ---
    return {
        websitesWithResults: processedWebsitesWithResults,
        overallStats: statsQuery.data ?? null,
        isLoading: isLoading,
        isFetching: isFetching,
        error: combinedError,
        refetch: refetch,
        totalWebsitesCount: totalWebsitesCount,
        upWebsitesCount: upWebsitesCount,
        incidentsLast24h: incidentsLast24h,
        lastIncidentTimestamp: lastIncidentTimestamp,
        lastIncidentWebsiteId: lastIncidentWebsiteId,
    };
}