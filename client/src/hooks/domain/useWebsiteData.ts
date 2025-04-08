/*
src/hooks/domain/useWebsiteData.ts
*/
import { useMemo, useCallback } from "react";
import {
    WebsiteUser,
    MonitoringResult,
    ApiError,
    OverallStats // Ensure OverallStats is imported
} from "../../types"; // Adjust path if needed
import { useUserWebsitesQuery } from "../api/useWebsites"; // Assuming correct path
import { useUserMonitoringResultsQuery, useUserStatsQuery } from "../api/useMonitoring"; // Assuming correct path

const RECENT_RESULTS_LIMIT_FOR_CARD = 20;

// Interface for the combined data structure for each website card
export interface WebsiteWithResults {
    userWebsite: WebsiteUser; // Contains all WebsiteUser fields including nested website, isPinned etc.
    latestResult?: MonitoringResult | null; // The most recent check result
    recentResults: MonitoringResult[]; // Limited array of recent results for sparkline etc.
}

// Interface for the hook's return value
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[]; // Array of combined data for cards
    overallStats: OverallStats | null; // Aggregated stats object (can be null during loading)
    isLoading: boolean; // True during initial data load
    isFetching: boolean; // True if any underlying query is fetching
    error: ApiError | null; // First error encountered from queries
    refetch: () => Promise<any>; // Function to refetch all data
    totalWebsitesCount: number; // Total websites user monitors
    upWebsitesCount: number; // Websites currently considered 'up'
    incidentsLast24h: number | null; // Count of down transitions in last 24h (can be null)
    lastIncidentTimestamp: string | null | undefined; // ISO string timestamp of last incident (or null/undefined)
    lastIncidentWebsiteId: number | null | undefined; // Website ID of the last incident source (or null/undefined)
}

/**
 * Custom hook to fetch and combine website list, monitoring results, and overall stats for the user dashboard.
 */
export function useWebsiteData(
    resultsLimit: number = 500, // How many historical results to fetch
    statsPeriod: string = 'week', // Period for overall stats (uptime, avg response)
    refetchInterval?: number | false // Optional auto-refetch interval
): WebsiteDataSummary {

    const queryOptions = useMemo(() => ({ refetchInterval }), [refetchInterval]);

    // --- Queries ---
    // Fetch user's website list (WebsiteUser objects, expected sorted by pin)
    const websitesQuery = useUserWebsitesQuery(queryOptions);
    // Fetch historical monitoring results for all user websites
    const resultsQuery = useUserMonitoringResultsQuery(resultsLimit, queryOptions);
    // Fetch overall stats (OverallStats object including lastIncidentWebsiteId)
    const statsQuery = useUserStatsQuery(statsPeriod, queryOptions);

    // --- Loading and Error States ---
    const isLoading = websitesQuery.isPending || resultsQuery.isPending || (statsQuery.isPending && !statsQuery.data);
    const isFetching = websitesQuery.isFetching || resultsQuery.isFetching || statsQuery.isFetching;
    const errors: (ApiError | null)[] = [websitesQuery.error, resultsQuery.error, statsQuery.error];
    const combinedError = errors.find(e => e !== null) ?? null;

    // --- Process and Combine Data ---
    const processedWebsitesWithResults = useMemo((): WebsiteWithResults[] => {
        // Guard clauses for data readiness
        if (!websitesQuery.isSuccess || !resultsQuery.isSuccess || !websitesQuery.data || !resultsQuery.data) {
            return [];
        }
        const userWebsites: WebsiteUser[] = websitesQuery.data; // Should be WebsiteUser[]
        const allMonitoringResults: MonitoringResult[] = resultsQuery.data;

        // Group results efficiently
        const resultsByWebsite = new Map<number, MonitoringResult[]>();
        allMonitoringResults.forEach(result => {
            if (result?.websiteId) {
                if (!resultsByWebsite.has(result.websiteId)) {
                    resultsByWebsite.set(result.websiteId, []);
                }
                // Ensure results are added; ideally sorted later if needed per site
                resultsByWebsite.get(result.websiteId)?.push(result);
            }
        });

        // Map WebsiteUser list to WebsiteWithResults structure
        const newProcessedWebsites: WebsiteWithResults[] = userWebsites.map(userWebsite => {
            const websiteId = userWebsite.websiteId;
            const siteResults = resultsByWebsite.get(websiteId) || []; // Get results for this site

            let latestResult: MonitoringResult | undefined | null = null;
            let recentResultsForCard: MonitoringResult[] = [];

            if (siteResults.length > 0) {
                 // Sort results *for this site* to find latest and prepare for sparkline
                 siteResults.sort((a, b) => {
                     const timeA = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
                     const timeB = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
                     return timeB - timeA; // Newest first
                 });
                 latestResult = siteResults[0];
                 // Slice for card display (sparkline)
                 recentResultsForCard = siteResults.slice(0, RECENT_RESULTS_LIMIT_FOR_CARD);
            }

            // Return the combined structure for this website
            return {
                 userWebsite, // The full WebsiteUser object
                 latestResult,
                 recentResults: recentResultsForCard
            };
        });

        return newProcessedWebsites;
    }, [websitesQuery.isSuccess, websitesQuery.data, resultsQuery.isSuccess, resultsQuery.data]);

    // --- Calculate Aggregate Counts ---
    const { totalWebsitesCount, upWebsitesCount } = useMemo(() => {
        const total = websitesQuery.data?.length ?? 0;
        // Count based on the processed data's latest result
        const up = processedWebsitesWithResults.reduce((count, website) => {
            if (website.latestResult?.isAvailable === true) {
                return count + 1;
            }
            return count;
        }, 0);
        return { totalWebsitesCount: total, upWebsitesCount: up };
    }, [websitesQuery.data, processedWebsitesWithResults]);

    // --- Extract Data from Overall Stats Query ---
    const { incidentsLast24h, lastIncidentTimestamp, lastIncidentWebsiteId } = useMemo(() => {
        // Safely access properties from statsQuery.data
        const stats = statsQuery.data;
        return {
             incidentsLast24h: stats?.incidentsLast24h ?? null, // Use null if not loaded
             lastIncidentTimestamp: stats?.lastIncidentTimestamp ?? null, // Use null if not loaded
             lastIncidentWebsiteId: stats?.lastIncidentWebsiteId ?? null // Use null if not loaded
        };
    }, [statsQuery.data]); // Depend only on the stats data object

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
        overallStats: statsQuery.data ?? null, // Return the full stats object or null
        isLoading: isLoading,
        isFetching: isFetching,
        error: combinedError,
        refetch: refetch,
        totalWebsitesCount: totalWebsitesCount,
        upWebsitesCount: upWebsitesCount,
        // Return extracted specific stats
        incidentsLast24h: incidentsLast24h,
        lastIncidentTimestamp: lastIncidentTimestamp,
        lastIncidentWebsiteId: lastIncidentWebsiteId, // Ensure this is returned
    };
}