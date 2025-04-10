// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";

import {
    ApiError,
    WebsiteWithResults, // Keep this type
    WebsiteDataSummary // Keep this type
} from "../../types"; // Adjust path if needed
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
import { useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path
// No need to import incident count hook here, it's part of OverallStats now

/**
 * Custom hook to fetch and combine website list (now including results/chart data/incident) and overall stats.
 * UPDATED: Simplifies calculations, relies more on backend data.
 */
export function useWebsiteData(
    statsPeriod: string = 'week', // Period for overall stats (e.g., 'day', 'week', 'month')
    refetchInterval?: number | false // Optional auto-refetch interval in ms
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({
        refetchInterval,
        staleTime: refetchInterval ? refetchInterval / 2 : 5 * 60 * 1000, // 5 minutes default stale time
        gcTime: 1000 * 60 * 15, // 15 minutes GC time
    }), [refetchInterval]);

    // --- TanStack Queries ---
    // Fetches WebsiteUser[] which now includes latestResult, chartData, currentIncident, etc.
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    // Fetches OverallStats which now includes incident counts/timestamps from backend
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    const isLoading = websitesQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    const isFetching = websitesQuery.isFetching || statsQuery.isFetching;
    const errors: (ApiError | null)[] = [websitesQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data ---
    // The backend service `getWebsitesForUser` now includes all necessary data within each WebsiteUser object.
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        if (!websitesQuery.isSuccess || !websitesQuery.data) {
            return [];
        }
        // Map directly, as the backend provides the enriched WebsiteUser object
        return websitesQuery.data.map(userWebsite => ({
             userWebsite
        }));
    }, [websitesQuery.isSuccess, websitesQuery.data]);


    // --- Calculate Aggregate Counts (Based on current state from website list) ---
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = processedWebsitesWithResults.length;
        // Determine "up" status: No current incident OR latest result is available (if no incident info)
        const up = processedWebsitesWithResults.reduce((count, item) => {
            const isDownIncident = item.userWebsite.currentIncident?.type === 'down';
            // If there's a down incident, it's down. Otherwise, rely on latestResult.
            if (!isDownIncident) {
                return count + 1;
            }
            // Consider explicitly checking latestResult as a fallback if needed:
            // const isAvailable = item.userWebsite.latestResult?.isAvailable ?? false;
            // if (!isDownIncident && isAvailable) { return count + 1; }

            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [processedWebsitesWithResults]);


    // --- Extract Specific Data from Overall Stats Query ---
    // These values now come directly from the backend's calculation via OverallStats
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
        // Refetch both queries concurrently
        const results = await Promise.allSettled([
            websitesQuery.refetch(),
            statsQuery.refetch(),
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[useWebsiteData] Refetch failed for query index ${index}:`, result.reason);
            }
        });
        return results;
    }, [websitesQuery, statsQuery]);


    // --- Return Value ---
    // Return type matches WebsiteDataSummary
    return {
        websitesWithResults: processedWebsitesWithResults,
        overallStats: statsQuery.data ?? null,
        isLoading,
        isFetching,
        error: combinedError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
        // Pass through the values derived from overallStats
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
    };
}