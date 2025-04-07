//client\src\hooks\api\useMonitoring.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryFilters // Import QueryFilters for setQueriesData
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    fetchAllUserMonitoringResults,
    FetchWebsiteDetailsParams,
} from '../../api/monitoringApi'; // Adjust path if needed
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult, // This is the shared type
    ApiError,
    TimeframeKey
} from '../../types'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // <--- IMPORT useAuth (ADJUST PATH AS NEEDED)

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    // Add userId to relevant keys
    details: (params: FetchWebsiteDetailsParams, userId: number | undefined) => [...monitoringQueryKeys.all, 'details', params.websiteId, { userId }, params] as const,
    userStats: (period: TimeframeKey | string, userId: number | undefined) => [...monitoringQueryKeys.all, 'stats', 'user', { period, userId }] as const,
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: number | undefined) => [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { period, userId }] as const,
    userResults: (limit: number | undefined, userId: number | undefined) => [...monitoringQueryKeys.all, 'userResults', { limit, userId }] as const,
};

// Define the helper type
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook to fetch detailed data for the Website Details page.
 * Includes userId in query key for user-specific caching/invalidation.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    // Use the updated query key function including userId
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // API likely uses token, params contains websiteId
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params);
        },
        // Enable only if userId and websiteId are valid
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        ...options,
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 * Assumes the backend now returns the new MonitoringResult on success.
 * Attempts to update the cache immediately and invalidates for robustness.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Get userId for invalidations and cache updates
    const userId = user?.id;

    // --- MODIFICATION: Expect MonitoringResult on success ---
    return useMutation< MonitoringResult, ApiError, number>({
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        // 'newCheckResult' is the MonitoringResult returned by the modified backend
        onSuccess: (newCheckResult, websiteId) => {
            console.log('Check completed successfully via API, received result:', newCheckResult);

            // --- Attempt Immediate UI Update using setQueriesData ---
            // Define a filter to target all active detail queries for this website and user
            const detailsQueryFilter: QueryFilters = {
                queryKey: ['monitoring', 'details', websiteId, { userId }],
                // type: 'active', // Only update queries currently active on the screen
                // exact: false // Match keys starting with the filter
            };

            console.log(`[setQueriesData] Attempting immediate update for queries matching filter: ${JSON.stringify(detailsQueryFilter.queryKey)}`);

            // Use setQueriesData to update all matching cache entries
            queryClient.setQueriesData<WebsiteDetailsData>(detailsQueryFilter, (oldData) => {
                if (!oldData) {
                    console.log("[setQueriesData] No old data found for a matching query, skipping update.");
                    return oldData;
                }

                console.log(`[setQueriesData] Updating cache for key: ${JSON.stringify(oldData)}`); // Log the specific key being updated

                // Create new data with updated latestResult and prepended recentCheck
                // Ensure we don't exceed the limit the old data might have had (optional)
                const currentLimit = oldData.recentChecks.length; // Or get limit from query key if stored there
                const updatedRecentChecks = [newCheckResult, ...oldData.recentChecks].slice(0, currentLimit || 25); // Prepend and maintain limit

                return {
                    ...oldData,
                    latestResult: newCheckResult, // Update latest result
                    recentChecks: updatedRecentChecks,
                    // Note: chartData and uptimePercent might become slightly stale here.
                    // Invalidation below will handle refetching them if needed.
                };
            });
            // --- End Immediate Update ---


            // --- Invalidation (Still useful as a fallback and for related data) ---
            // Use predicate to ensure stats/charts etc related to this website are also refreshed
            console.log(`Invalidating queries related to websiteId: ${websiteId} for user: ${userId} using predicate.`);
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    const isMonitoringScope = key[0] === 'monitoring';
                    // Invalidate details AND stats for this website
                    const matchesType = key[1] === 'details' || key[1] === 'stats';
                    const matchesWebsiteId = key[2] === websiteId;
                    const matchesUser = userId
                        ? key.some(k => typeof k === 'object' && k !== null && 'userId' in k && k.userId === userId)
                        : true;
                    return isMonitoringScope && matchesType && matchesWebsiteId && matchesUser;
                }
            });

            // Also invalidate the general user results list (e.g., for dashboard)
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId).slice(0, 3) });

            console.log("Invalidation attempt complete using predicate.");
            // ------------------------------------------

        },
        onError: (error) => {
            console.error('Failed to trigger website check:', error.message);
            // Consider adding user feedback here (e.g., toast notification)
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 0,
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: monitoringQueryKeys.websiteStats(websiteId, period, userId),
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        staleTime: 1000 * 60 * 2,
        ...options,
    });
}

/**
 * Hook to fetch all monitoring results for the user (used by useWebsiteData).
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: CustomQueryOptions<MonitoringResult[]>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<MonitoringResult[], ApiError>({
        queryKey: monitoringQueryKeys.userResults(limit, userId),
        queryFn: () => {
             if (!userId) return Promise.resolve([]);
             return fetchAllUserMonitoringResults(limit);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 0,
        ...options,
    });
}