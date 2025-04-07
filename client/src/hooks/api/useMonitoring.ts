//client\src\hooks\api\useMonitoring.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey, // Import QueryKey type
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
import { useAuth } from '../../context/AuthContext'; // Adjust path as needed

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    // Details for a specific website (includes user ID for context and specific params)
    // Key structure: ['monitoring', 'details', websiteId, { userId, timeframe, limit, sortBy, sortDir }] - adjusted to match query usage
    details: (params: FetchWebsiteDetailsParams, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, ...params }] as const,
    // User's overall dashboard stats
    userStats: (period: TimeframeKey | string, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    // Stats for a specific website (includes user ID for context)
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    // User's recent monitoring results list
    userResults: (limit: number | undefined, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,
};

// Define the helper type for custom query options
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn' // Exclude keys managed by the hook
>;

/**
 * Hook to fetch detailed data for the Website Details page.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    // Ensure all params used in the key definition are passed
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            // Pass all params needed by the API
            return fetchWebsiteDetails(params);
        },
        // Enable only if required IDs are present
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30, // Example: 30 seconds stale time from user's code
        gcTime: 1000 * 60 * 5, // Example: 5 minutes cache time from user's code
        ...options, // Spread any other options like placeholderData, refetchOnWindowFocus, etc.
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 * Assumes the backend now returns the new MonitoringResult on success.
 * Attempts to update the cache immediately and invalidates for robustness.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id; // Needed for identifying user-specific data

    // --- MODIFICATION: Expect MonitoringResult on success ---
    return useMutation< MonitoringResult, ApiError, number>({
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        // 'newCheckResult' is the MonitoringResult returned by the modified backend
        onSuccess: (newCheckResult, websiteId) => {
            console.log(`[Mutation Success] Check completed for website ${websiteId}, received result:`, newCheckResult);

            // --- Attempt Immediate UI Update using setQueriesData ---
            // Define a filter to target *active* detail queries for this website and user.
            // We match the start of the key, ignoring the specific params part.
            const detailsQueryFilter: QueryFilters = {
                 // Partial key: ['monitoring', 'details', websiteId, { userId }]
                queryKey: [...monitoringQueryKeys.all, 'details', websiteId, { userId }],
                // exact: false, // Match keys starting with this pattern (default is false)
                 type: 'active', // Only update queries currently active (mounted components)
            };

            console.log(`[setQueriesData] Attempting immediate update for queries matching filter: ${JSON.stringify(detailsQueryFilter.queryKey)}`);

            // Use setQueriesData to update all matching cache entries
            const updatedCount = queryClient.setQueriesData<WebsiteDetailsData>(detailsQueryFilter, (oldData) => {
                if (!oldData) {
                    console.log("[setQueriesData] No old data found for a matching query, skipping update for this entry.");
                    return undefined; // Return undefined to not change this specific cache entry
                }

                console.log(`[setQueriesData] Updating cache for key: ${JSON.stringify(queryClient.getQueryCache().find(detailsQueryFilter)?.queryKey)}`, oldData); // Log more info

                // Prepend new result, maintain original limit if possible, otherwise default
                const currentLimit = oldData.recentChecks?.length ?? 25;
                const updatedRecentChecks = [newCheckResult, ...(oldData.recentChecks ?? [])].slice(0, currentLimit);

                return {
                    ...oldData,
                    latestResult: newCheckResult, // Update latest result
                    recentChecks: updatedRecentChecks,
                    // Note: chartData and uptimePercent will be stale until invalidation triggers refetch
                };
            });
            console.log(`[setQueriesData] Updated ${updatedCount} cache entries.`);
            // --- End Immediate Update ---


            // --- Invalidation (Still useful as a fallback and for related data) ---
            // Use partial keys for broader invalidation

            // 1. Invalidate ALL details queries for this specific websiteId (regardless of user/params).
            const detailsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern });
            console.log(`Invalidating ALL details for website ${websiteId}:`, detailsKeyPattern);

            // 2. Invalidate ALL website-specific stats queries for this websiteId AND this userId.
            const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern });
            console.log(`Invalidating website stats for website ${websiteId}, user ${userId}:`, websiteStatsKeyPattern);

            // 3. Invalidate ALL user results list queries for this userId.
            const userResultsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
            queryClient.invalidateQueries({ queryKey: userResultsKeyPattern });
            console.log(`Invalidating user results for user ${userId}:`, userResultsKeyPattern);

            // 4. Invalidate the user's OVERALL stats as well.
            const userStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];
            queryClient.invalidateQueries({ queryKey: userStatsKeyPattern });
            console.log(`Invalidating overall user stats for user ${userId}:`, userStatsKeyPattern);

            console.log(`[Invalidation Complete] Monitoring data related to website ${websiteId} for user ${userId}`);
            // --- End Invalidation ---

        },
        onError: (error, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message);
            // Consider showing a toast/notification to the user
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
        staleTime: 1000 * 60 * 5, // Stale time from user's code
        gcTime: 1000 * 60 * 15, // Cache time from user's code
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id;

    // Determine if the query should be enabled
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: monitoringQueryKeys.websiteStats(websiteId, period, userId),
        queryFn: () => {
            // Check enabled status again within queryFn for type safety
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled, // Use the derived enabled status
        staleTime: 1000 * 60 * 2, // Stale time from user's code
        gcTime: 1000 * 60 * 10, // Cache time from user's code
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
             if (!userId) return Promise.resolve([]); // Return empty array if no user
             return fetchAllUserMonitoringResults(limit);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000 * 15, // Stale time from user's code
        gcTime: 1000 * 60 * 5, // Cache time from user's code
        ...options,
    });
}