// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";

import {
    WebsiteUser,
    ApiError,
    OverallStats
} from "../../types"; // Adjust path if needed
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
import { useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path


// Interface for the combined data structure for each website card
export interface WebsiteWithResults {
    userWebsite: WebsiteUser; // Contains all WebsiteUser fields including nested data
}

// Interface for the hook's return value
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
    statsPeriod: string = 'week', // Period for overall stats (e.g., 'day', 'week', 'month')
    refetchInterval?: number | false // Optional auto-refetch interval in ms
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({
        refetchInterval,
        staleTime: refetchInterval ? refetchInterval / 2 : 5 * 60 * 1000,
    }), [refetchInterval]);

    // --- TanStack Queries ---
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    const isLoading = websitesQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    const isFetching = websitesQuery.isFetching || statsQuery.isFetching;
    const errors: (ApiError | null)[] = [websitesQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data ---
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        if (!websitesQuery.isSuccess || !websitesQuery.data) {
            return [];
        }
        const userWebsites: WebsiteUser[] = websitesQuery.data;

        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => ({
             userWebsite // Map directly
        }));

        return newProcessedWebsites;
    }, [websitesQuery.isSuccess, websitesQuery.data]);


    // --- Calculate Aggregate Counts ---
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = processedWebsitesWithResults.length;
        const up = processedWebsitesWithResults.reduce((count, item) => {
            if (item.userWebsite.latestResult?.isAvailable === true) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [processedWebsitesWithResults]);


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
    return {
        websitesWithResults: processedWebsitesWithResults,
        overallStats: statsQuery.data ?? null,
        isLoading, // Simplified return
        isFetching, // Simplified return
        error: combinedError,
        refetch, // Simplified return
        totalWebsitesCount, // Simplified return
        upWebsitesCount, // Simplified return
        incidentsLast24h, // Simplified return
        lastIncidentTimestamp, // Simplified return
        lastIncidentWebsiteId, // Simplified return
    };
}