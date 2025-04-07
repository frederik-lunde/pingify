// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";
import { WebsiteUser, MonitoringResult, ApiError, OverallStats } from "../../types"; // Adjust path
import { useUserWebsitesQuery } from "../api/useWebsites";
import { useUserMonitoringResultsQuery } from "../api/useMonitoring"; // Hook to fetch all results
import { useUserStatsQuery } from "../api/useMonitoring"; // Hook to fetch user stats

const RECENT_RESULTS_LIMIT_FOR_CARD = 20;

export interface WebsiteWithResults {
  userWebsite: WebsiteUser;
  latestResult?: MonitoringResult;
  recentResults: MonitoringResult[];
}

export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[];
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>;
    // Add calculated counts
    totalWebsitesCount: number;
    upWebsitesCount: number;
}

export function useWebsiteData(
    resultsLimit: number = 500, // Keep limit for results fetching
    statsPeriod: string = 'week',
    refetchInterval?: number | false
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({ refetchInterval }), [refetchInterval]);

    // --- Queries ---
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    // Fetch results - needed for up/down calculation now
    const resultsQuery = useUserMonitoringResultsQuery(resultsLimit, queryOptions);
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions); // Still fetch overall stats like uptime/response

    // --- Loading and Error States ---
    // isLoading depends on websites and results being ready for the counts
    const isLoading = websitesQuery.isPending || resultsQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    const isFetching = websitesQuery.isFetching || resultsQuery.isFetching || statsQuery.isFetching;
    const errors: (ApiError | null)[] = [websitesQuery.error, resultsQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process Website Data with useMemo ---
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        if (!websitesQuery.isSuccess || !resultsQuery.isSuccess) {
            return [];
        }
        const userWebsites = websitesQuery.data;
        const allMonitoringResults = resultsQuery.data;
        if (!userWebsites || !allMonitoringResults) { // Removed length check here, handle empty list below
            return [];
        }

        // --- Combination logic ---
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        allMonitoringResults.forEach(result => {
            if (result?.websiteId) {
                if (!resultsByWebsite.has(result.websiteId)) {
                    resultsByWebsite.set(result.websiteId, []);
                }
                resultsByWebsite.get(result.websiteId)?.push(result);
            }
        });

        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => {
            const websiteId = userWebsite.websiteId;
            const siteResults = resultsByWebsite.get(websiteId) || [];
            if (siteResults.length > 0) {
                 siteResults.sort((a, b) => {
                     const timeA = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
                     const timeB = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
                     return timeB - timeA;
                 });
                 const latestResult = siteResults[0];
                 const recentResults = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);
                 // Ensure latestResult is included even if only 1 result exists
                 return { userWebsite, latestResult, recentResults: recentResults.length > 0 ? recentResults : (latestResult ? [latestResult] : []) };
             } else {
                 return { userWebsite, latestResult: undefined, recentResults: [] };
             }
        });
        return newProcessedWebsites;
    }, [websitesQuery.isSuccess, websitesQuery.data, resultsQuery.isSuccess, resultsQuery.data]);

    // --- Calculate Counts ---
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        // Total count is based on the list of websites fetched, regardless of results
        const total = websitesQuery.data?.length ?? 0;
        // Up count is based on processed results where latestResult indicates available
        const up = processedWebsitesWithResults.reduce((count, website) => {
            // Consider 'up' if the latest result exists and explicitly says isAvailable: true
            if (website.latestResult?.isAvailable === true) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    // Depend on the raw website data for total and processed results for up count
    }, [websitesQuery.data, processedWebsitesWithResults]);

    // --- Refetch Function ---
    const refetch = useCallback(async () => {
        console.log('[useWebsiteData] Triggering refetch...');
        const results = await Promise.allSettled([
            websitesQuery.refetch(),
            resultsQuery.refetch(),
            statsQuery.refetch(),
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Refetch failed for query ${index}:`, result.reason);
            }
        });
        return results;
    }, [websitesQuery, resultsQuery, statsQuery]);

    // --- Return Value ---
    return {
        websitesWithResults: processedWebsitesWithResults,
        overallStats: statsQuery.data ?? null,
        isLoading: isLoading,
        isFetching: isFetching,
        error: combinedError,
        refetch: refetch,
        // Return the calculated counts
        totalWebsitesCount: totalWebsitesCount,
        upWebsitesCount: upWebsitesCount,
    };
}