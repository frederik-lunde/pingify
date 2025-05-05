// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";

import {
    ApiError,
    WebsiteDataSummary, // Import the newly defined type
    WebsiteUser // Import WebsiteUser if not already implicitly available
} from "../../types"; // Adjust path if needed
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
import { useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path

/**
 * Custom hook to fetch and combine website list and overall stats.
 */
export function useWebsiteData(
    statsPeriod: string = 'week',
    refetchInterval?: number | false
): WebsiteDataSummary { // Use the defined return type

    const queryOptions = useMemo(() => ({
        refetchInterval,
        staleTime: refetchInterval ? refetchInterval / 2 : 5 * 60 * 1000,
        gcTime: 1000 * 60 * 15,
    }), [refetchInterval]);

    const websitesQuery = useUserWebsitesQuery(queryOptions);
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    const isLoading = websitesQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    const isFetching = websitesQuery.isFetching || statsQuery.isFetching;
    const errors: (ApiError | null)[] = [websitesQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data ---
    // --- MODIFIED: Rename and simplify ---
    const websiteCards = useMemo((): WebsiteUser[] => { // Type is now WebsiteUser[]
        if (!websitesQuery.isSuccess || !websitesQuery.data) {
            return [];
        }
        // The data from useUserWebsitesQuery is already WebsiteUser[]
        return websitesQuery.data;
    }, [websitesQuery.isSuccess, websitesQuery.data]);


    // --- Calculate Aggregate Counts ---
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        // --- MODIFIED: Use websiteCards ---
        const total = websiteCards.length;
        const up = websiteCards.reduce((count, item) => {
            // Logic remains the same, operates directly on WebsiteUser item
            const isDownIncident = item.currentIncident?.type === 'down';
            if (!isDownIncident) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [websiteCards]); // Depend on websiteCards


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
    // Structure matches WebsiteDataSummary
    return {
        // --- MODIFIED: Use websiteCards ---
        websiteCards: websiteCards,
        overallStats: statsQuery.data ?? null,
        isLoading,
        isFetching,
        error: combinedError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
    };
}