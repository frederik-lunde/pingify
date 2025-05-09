import { useMemo, useCallback } from "react";
import {
    ApiError,
    WebsiteDataSummary,
    WebsiteUser
} from "../../types";
import { useUserWebsitesQuery } from "../api/useWebsites";
import { useUserStatsQuery } from "../api/useMonitoring";

/**
 * Custom hook to fetch and consolidate website data and statistics.
 */
export function useWebsiteData(
    statsPeriod: string = 'week',
    refetchInterval?: number | false
): WebsiteDataSummary {
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

    const websiteCards = useMemo((): WebsiteUser[] => {
        if (!websitesQuery.isSuccess || !websitesQuery.data) {
            return [];
        }
        return websitesQuery.data;
    }, [websitesQuery.isSuccess, websitesQuery.data]);

    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = websiteCards.length;
        const up = websiteCards.reduce((count, item) => {
            const isDownIncident = item.currentIncident?.type === 'down';
            if (!isDownIncident) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [websiteCards]);

    const { incidentsLast24h, lastIncidentTimestamp, lastIncidentWebsiteId } = useMemo(() => {
        const stats = statsQuery.data;
        return {
             incidentsLast24h: stats?.incidentsLast24h ?? null,
             lastIncidentTimestamp: stats?.lastIncidentTimestamp ?? null,
             lastIncidentWebsiteId: stats?.lastIncidentWebsiteId ?? null
        };
    }, [statsQuery.data]);

    const refetch = useCallback(async () => {
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

    return {
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