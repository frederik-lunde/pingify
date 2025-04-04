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
    isLoading: boolean; // True during the *initial* loading phase of essential data
    isFetching: boolean; // True if any query is fetching (initial or background)
    error: ApiError | null;
    refetch: () => Promise<any>;
}

export function useWebsiteData(
    resultsLimit: number = 500,
    statsPeriod: string = 'week',
    refetchInterval?: number | false
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({ refetchInterval }), [refetchInterval]);

    // --- Queries (No initialData passed here or set internally in hooks being called) ---
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    const resultsQuery = useUserMonitoringResultsQuery(resultsLimit, queryOptions);
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    // Use isPending (v5) or isLoading (v4) for initial load status
    const isLoading = websitesQuery.isPending || resultsQuery.isPending;
    const isFetching = websitesQuery.isFetching || resultsQuery.isFetching || statsQuery.isFetching;
    const error = websitesQuery.error || resultsQuery.error || statsQuery.error;

    // --- Process Data with useMemo (Simplified Guards) ---
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        console.log(`[useWebsiteData Memo Simplified] Running. Statuses: W=${websitesQuery.status}, R=${resultsQuery.status}. Data Lengths: W=${websitesQuery.data?.length ?? 'undef'}, R=${resultsQuery.data?.length ?? 'undef'}`);

        // Guard 1: Ensure both queries are successful
        if (!websitesQuery.isSuccess || !resultsQuery.isSuccess) {
            console.log('[useWebsiteData Memo Simplified] Returning early: Queries not successful.');
            return [];
        }

        // Guard 2: Access data. Should exist and not be undefined here if isSuccess is true.
        const userWebsites = websitesQuery.data;
        const allMonitoringResults = resultsQuery.data;

        // Guard 3: Check data is actually available (maybe redundant if isSuccess works as expected, but safe)
         if (!userWebsites || !allMonitoringResults) {
             console.log('[useWebsiteData Memo Simplified] Returning early: Data array(s) missing after success status.');
             return [];
         }

         // Guard 4: Handle genuinely empty websites list
         if (userWebsites.length === 0) {
            console.log('[useWebsiteData Memo Simplified] No actual user websites found (length 0).');
            return [];
         }

        console.log(`[useWebsiteData Memo Simplified] Processing ${userWebsites.length} websites...`);
        // --- Combination logic ---
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        allMonitoringResults.forEach(result => {
            if (result && result.websiteId) {
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
                     return timeB - timeA; // Sort newest first
                 });
                 const latestResult = siteResults[0];
                 const recentResults = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);
                 return { userWebsite, latestResult, recentResults };
             } else {
                 return { userWebsite, latestResult: undefined, recentResults: [] };
             }
        });

        console.log(`[useWebsiteData Memo Simplified] Processing complete. Returning ${newProcessedWebsites.length} items.`);
        return newProcessedWebsites;

    // Dependency array: Depend on success status and data references
    }, [
        websitesQuery.isSuccess,
        resultsQuery.isSuccess,
        websitesQuery.data,
        resultsQuery.data
    ]);

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
    console.log(`[useWebsiteData Render] isLoading: ${isLoading}, isFetching: ${isFetching}, Processed Data Count: ${processedWebsitesWithResults.length}`);
    return {
        websitesWithResults: processedWebsitesWithResults,
        overallStats: statsQuery.data ?? null,
        isLoading: isLoading, // Use the pending status for the main loader
        isFetching: isFetching,
        error: error,
        refetch: refetch,
    };
}