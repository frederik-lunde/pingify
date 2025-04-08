// src/hooks/domain/useWebsiteData.ts
// No changes needed based on the merge, assuming the provided version is correct.
// It already returns the necessary fields including `lastIncidentTimestamp` and `lastIncidentWebsiteId`.

import { useMemo, useCallback } from "react";
//
import {
    WebsiteUser,
    //
    MonitoringResult,
    //
    ApiError,
    //
    OverallStats // Ensure OverallStats is imported
    //
} from "../../types"; // Adjust path if needed
//
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
//
import { useUserMonitoringResultsQuery, useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path

const RECENT_RESULTS_LIMIT_FOR_CARD = 20; // How many results to show on the card sparkline
//

// Interface for the combined data structure for each website card
export interface WebsiteWithResults {
    userWebsite: WebsiteUser; // Contains all WebsiteUser fields including nested website, isPinned etc.
    //
    latestResult?: MonitoringResult | null; // The most recent check result
    //
    recentResults: MonitoringResult[]; // Limited array of recent results for sparkline etc.
}

// Interface for the hook's return value
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[]; // Array of combined data for cards
    //
    overallStats: OverallStats | null; // Aggregated stats object (can be null during loading)
    //
    isLoading: boolean; // True during initial data load of any critical query
    //
    isFetching: boolean; // True if any underlying query is fetching (background update)
    //
    error: ApiError | null; // First error encountered from queries
    //
    refetch: () => Promise<any>; // Function to refetch all data
    //
    totalWebsitesCount: number; // Total websites user monitors
    //
    upWebsitesCount: number; // Websites currently considered 'up'
    //
    incidentsLast24h: number | null; // Count of down transitions in last 24h (can be null)
    //
    lastIncidentTimestamp: string | null | undefined; // ISO string timestamp of last incident (or null/undefined)
    //
    lastIncidentWebsiteId: number | null | undefined; // Website ID of the last incident source (or null/undefined)
}

/**
 * Custom hook to fetch and combine website list, monitoring results, and overall stats for the user dashboard.
 */
export function useWebsiteData(
    resultsLimit: number = 500, // How many historical results to fetch per website (adjust as needed)
    //
    statsPeriod: string = 'week', // Period for overall stats (e.g., 'day', 'week', 'month')
    //
    refetchInterval?: number | false // Optional auto-refetch interval in ms
    //
): WebsiteDataSummary {

    // Memoize query options to prevent unnecessary refetches if interval doesn't change
    const queryOptions = useMemo(() => ({
        refetchInterval,
        //
        staleTime: refetchInterval ? refetchInterval / 2 : 5 * 60 * 1000, // Example: Stale after half the interval or 5 mins
        //
    }), [refetchInterval]);
    //

    // --- TanStack Queries ---
    // Fetch user's website list (WebsiteUser objects)
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    //

    // Fetch historical monitoring results for all user websites
    // Consider if fetching *all* results is efficient or if it should be per-website on demand
    const resultsQuery = useUserMonitoringResultsQuery(resultsLimit, queryOptions);
    //

    // Fetch overall stats (OverallStats object including lastIncidentWebsiteId)
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);
    //

    // --- Loading and Error States ---
    // isLoading is true if essential data for initial render is pending
    const isLoading = websitesQuery.isPending || resultsQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    //
    // isFetching is true if any query is running (initial or background)
    const isFetching = websitesQuery.isFetching || resultsQuery.isFetching || statsQuery.isFetching;
    //
    // Combine errors, prioritizing the first one encountered
    const errors: (ApiError | null)[] = [websitesQuery.error, resultsQuery.error, statsQuery.error];
    //
    const combinedError = errors.find(e => e !== null) ?? null;
    //

    // --- Process and Combine Data ---
    // Memoize the combined data structure to avoid recalculation unless dependencies change
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        // Guard clauses: ensure data is available and successfully fetched
        if (!websitesQuery.isSuccess || !resultsQuery.isSuccess || !websitesQuery.data || !resultsQuery.data) {
            return []; // Return empty array if data isn't ready
            //
        }
        const userWebsites: WebsiteUser[] = websitesQuery.data;
        //
        const allMonitoringResults: MonitoringResult[] = resultsQuery.data;
        //

        // Group results by websiteId for efficient lookup
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        //
        allMonitoringResults.forEach(result => {
            if (result?.websiteId) {
                const list = resultsByWebsite.get(result.websiteId) || [];
                //
                list.push(result);
                //
                resultsByWebsite.set(result.websiteId, list);
                //
            }
        });
        //

        // Map WebsiteUser list to the WebsiteWithResults structure
        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => {
            const websiteId = userWebsite.websiteId;
            //
            const siteResults = resultsByWebsite.get(websiteId) || []; // Get results for this site
            //

            let latestResult: MonitoringResult | undefined | null = null;
            //
            let recentResultsForCard: MonitoringResult[] = [];
            //

            if (siteResults.length > 0) {
                 // Sort results *for this specific site* by time (descending) to find the latest
                 // and prepare the list for the sparkline (which usually expects chronological order, so reverse might be needed later)
                 siteResults.sort((a, b) => {
                     const timeA = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
                     //
                     const timeB = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
                     //
                     return timeB - timeA; // Newest first
                     //
                 });
                 latestResult = siteResults[0]; // The first element is the latest after sorting
                 //
                 // Slice the most recent results for the card display (e.g., sparkline)
                 // Note: Sparklines often need data oldest-to-newest, so you might need to .reverse() this slice depending on the component
                 recentResultsForCard = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);
                 //
            }
            //

            // Return the combined structure for this website card
            return {
                 userWebsite, // The full WebsiteUser object (includes name, url, pin status etc.)
                 //
                 latestResult, // The single most recent result
                 //
                 recentResults: recentResultsForCard // Array of recent results for the card
                 //
            };
            //
        });
        //

        // Note: Sorting (pinned, status, user selection) is NOT done here.
        // It's handled in the Dashboard component *after* this hook provides the combined data.
        return newProcessedWebsites;
        //

    }, [websitesQuery.isSuccess, websitesQuery.data, resultsQuery.isSuccess, resultsQuery.data]); // Dependencies for memoization
    //

    // --- Calculate Aggregate Counts ---
    // Memoize counts based on the raw website list and processed results
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = websitesQuery.data?.length ?? 0;
        //
        // Count 'up' websites based on the latest result processed
        const up = processedWebsitesWithResults.reduce((count, website) => {
            // Consider a website 'up' if its latest result explicitly shows isAvailable = true
            if (website.latestResult?.isAvailable === true) {
                return count + 1;
                //
            }
            return count;
            //
        }, 0);
        //
        return { totalWebsitesCount: total, upWebsitesCount: up };
        //
    }, [websitesQuery.data, processedWebsitesWithResults]); // Dependencies for memoization
    //

    // --- Extract Specific Data from Overall Stats Query ---
    // Memoize extraction to avoid re-evaluation if statsQuery.data hasn't changed
    const { incidentsLast24h, lastIncidentTimestamp, lastIncidentWebsiteId } = useMemo(() => {
        const stats = statsQuery.data; // Get the stats object
        //
        return {
             // Provide null as default if stats or specific properties are not yet loaded
             incidentsLast24h: stats?.incidentsLast24h ?? null,
             //
             lastIncidentTimestamp: stats?.lastIncidentTimestamp ?? null,
             //
             lastIncidentWebsiteId: stats?.lastIncidentWebsiteId ?? null
             //
        };
        //
    }, [statsQuery.data]); // Depend only on the stats data object
    //

    // --- Refetch Function ---
    // useCallback ensures the refetch function reference is stable unless dependencies change
    const refetch = useCallback(async () => {
        console.log('[useWebsiteData] Triggering refetch for all dashboard queries...');
        //
        // Trigger refetch for all underlying queries concurrently
        const results = await Promise.allSettled([
            websitesQuery.refetch(),
            //
            resultsQuery.refetch(),
            //
            statsQuery.refetch(),
            //
        ]);
        //
        // Log any errors during refetch
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[useWebsiteData] Refetch failed for query index ${index}:`, result.reason);
                //
            }
        });
        //
        return results; // Return array of settled promises
        //
    }, [websitesQuery, resultsQuery, statsQuery]); // Dependencies for useCallback
    //

    // --- Return Value ---
    // Assemble the final object returned by the hook
    return {
        websitesWithResults: processedWebsitesWithResults, // The combined data for each website card
        //
        overallStats: statsQuery.data ?? null, // The full stats object or null if loading/error
        //
        isLoading: isLoading, // Overall initial loading state
        //
        isFetching: isFetching, // Overall fetching state (initial or background)
        //
        error: combinedError, // Combined error state
        //
        refetch: refetch, // Function to manually trigger data refresh
        //
        totalWebsitesCount: totalWebsitesCount, // Total number of websites
        //
        upWebsitesCount: upWebsitesCount, // Number of websites currently up
        //
        // Return extracted specific stats for convenience
        incidentsLast24h: incidentsLast24h,
        //
        lastIncidentTimestamp: lastIncidentTimestamp,
        //
        lastIncidentWebsiteId: lastIncidentWebsiteId, // Ensure this ID is returned for highlighting
        //
    };
    //
}