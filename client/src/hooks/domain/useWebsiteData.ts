// client/src/hooks/domain/useWebsiteData.ts
import { useMemo, useCallback } from "react";
import { WebsiteUser, MonitoringResult, ApiError, OverallStats } from "../../types"; // Adjust path
import { useUserWebsitesQuery } from "../api/useWebsites";
import { useUserMonitoringResultsQuery } from "../api/useMonitoring"; // Hook to fetch all results
import { useUserStatsQuery } from "../api/useMonitoring"; // Hook to fetch user stats

const RECENT_RESULTS_LIMIT_FOR_CARD = 20;

// Interface for the combined data structure for each website
// Uses WebsiteUser which now implicitly includes isPinned
export interface WebsiteWithResults {
  userWebsite: WebsiteUser;
  latestResult?: MonitoringResult;
  recentResults: MonitoringResult[];
}

// Interface for the hook's return value
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[]; // This array will be sorted by pin status by the source query
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>;
    // Add calculated counts
    totalWebsitesCount: number;
    upWebsitesCount: number;
}

/**
 * Custom hook to fetch and combine website list, monitoring results, and overall stats for the user dashboard.
 * Data is fetched already sorted by pin status from the API layer.
 */
export function useWebsiteData(
    resultsLimit: number = 500, // Limit for fetching monitoring results history
    statsPeriod: string = 'week', // Time period for overall stats calculation
    refetchInterval?: number | false // Optional interval for automatic refetching
): WebsiteDataSummary {

    // Memoize query options to prevent unnecessary refetches if interval changes reference but not value
    const queryOptions = useMemo(() => ({ refetchInterval }), [refetchInterval]);

    // --- Queries ---
    // Fetches user's websites, already sorted by pin status (desc) then URL (asc) by the backend via useUserWebsitesQuery
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    // Fetches a batch of recent monitoring results for all user websites
    const resultsQuery = useUserMonitoringResultsQuery(resultsLimit, queryOptions);
    // Fetches overall statistics (uptime, avg response time) for the user over the specified period
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    // Combined loading state: true if essential queries are pending initially
    const isLoading = websitesQuery.isPending || resultsQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    // Combined fetching state: true if any query is currently fetching (including background refetches)
    const isFetching = websitesQuery.isFetching || resultsQuery.isFetching || statsQuery.isFetching;
    // Combine potential errors from the queries
    const errors: (ApiError | null)[] = [websitesQuery.error, resultsQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data with useMemo ---
    // Memoized calculation to combine website list with their corresponding monitoring results
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        // Ensure both essential queries have successfully fetched data
        if (!websitesQuery.isSuccess || !resultsQuery.isSuccess) {
            return []; // Return empty array if data isn't ready
        }
        const userWebsites = websitesQuery.data; // Array of WebsiteUser (includes isPinned)
        const allMonitoringResults = resultsQuery.data; // Array of MonitoringResult

        // Basic check if data is available
        if (!userWebsites || !allMonitoringResults) {
            return [];
        }

        // --- Efficiently group results by website ID ---
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        allMonitoringResults.forEach(result => {
            if (result?.websiteId) { // Ensure result and websiteId exist
                if (!resultsByWebsite.has(result.websiteId)) {
                    resultsByWebsite.set(result.websiteId, []);
                }
                // Add the result to the list for that website
                resultsByWebsite.get(result.websiteId)?.push(result);
            }
        });

        // --- Map user websites to include their latest and recent results ---
        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => {
            const websiteId = userWebsite.websiteId;
            // Get results for this specific website, default to empty array if none found
            const siteResults = resultsByWebsite.get(websiteId) || [];

            let latestResult: MonitoringResult | undefined = undefined;
            let recentResultsForCard: MonitoringResult[] = [];

            if (siteResults.length > 0) {
                 // Sort results for this site by date descending to easily find the latest
                 siteResults.sort((a, b) => {
                     const timeA = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
                     const timeB = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
                     return timeB - timeA; // Latest first
                 });
                 latestResult = siteResults[0]; // The first item is the latest
                 // Get a slice of the most recent results for the card display
                 recentResultsForCard = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);
            }

            // Return the combined structure
            return {
                 userWebsite, // The full WebsiteUser object (including isPinned)
                 latestResult,
                 recentResults: recentResultsForCard // Pass the limited recent results
            };
        });

        // The final array maintains the sort order from websitesQuery.data (pinned first)
        return newProcessedWebsites;

    // Dependencies for the memoization
    }, [websitesQuery.isSuccess, websitesQuery.data, resultsQuery.isSuccess, resultsQuery.data]);

    // --- Calculate Aggregate Counts ---
    // Memoized calculation for total and "up" website counts
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        // Total count is simply the number of websites the user is monitoring
        const total = websitesQuery.data?.length ?? 0;

        // "Up" count is derived from the processed data, checking the latest result's status
        const up = processedWebsitesWithResults.reduce((count, website) => {
            // Count as 'up' only if the latest result is available and indicates isAvailable: true
            if (website.latestResult?.isAvailable === true) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    // Dependencies for the count calculation
    }, [websitesQuery.data, processedWebsitesWithResults]);

    // --- Refetch Function ---
    // Provides a way to manually trigger a refetch of all data used by this hook
    const refetch = useCallback(async () => {
        console.log('[useWebsiteData] Triggering refetch...');
        // Refetch all underlying queries concurrently
        const results = await Promise.allSettled([
            websitesQuery.refetch(),
            resultsQuery.refetch(),
            statsQuery.refetch(),
        ]);
        // Log any errors during refetch for debugging
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Refetch failed for query ${index}:`, result.reason);
            }
        });
        return results; // Return the settled promises array
    }, [websitesQuery, resultsQuery, statsQuery]); // Dependencies for the refetch callback

    // --- Return Value ---
    // Expose the combined data, loading/error states, counts, and refetch function
    return {
        websitesWithResults: processedWebsitesWithResults, // The core combined data, sorted by pin status
        overallStats: statsQuery.data ?? null, // Overall user stats (uptime, response time)
        isLoading: isLoading, // True during initial load of essential data
        isFetching: isFetching, // True when any query is fetching (initial or background)
        error: combinedError, // The first error encountered among the queries
        refetch: refetch, // Function to manually refetch all data
        totalWebsitesCount: totalWebsitesCount, // Total number of websites monitored by the user
        upWebsitesCount: upWebsitesCount, // Number of websites currently considered "up"
    };
}