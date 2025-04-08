// client/src/hooks/api/useMonitoring.ts
// No changes needed in this file.
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey,
    QueryFilters // Ensure QueryFilters is imported
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck, // Assumes API file is corrected
    fetchUserStats,
    fetchWebsiteStats,
    fetchAllUserMonitoringResults,
    FetchWebsiteDetailsParams,
} from '../../api/monitoringApi'; // Adjust path if needed
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey
} from '../../types'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // Adjust path as needed

// Query Keys (Unchanged)
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    details: (params: FetchWebsiteDetailsParams, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, ...params }] as const,
    userStats: (period: TimeframeKey | string, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    userResults: (limit: number | undefined, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,
};

// Helper type (Unchanged)
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook to fetch detailed data for the Website Details page. (Unchanged)
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params);
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 * Simplified version focusing on core optimistic update and robust invalidation.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id; // Needed for invalidation targeting

    return useMutation<MonitoringResult, ApiError, number>({
        mutationFn: (websiteId: number) => {
            if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
                return Promise.reject(new Error("Invalid Website ID provided."));
            }
            return triggerWebsiteCheck(websiteId);
        },
        onSuccess: (newCheckResult, websiteId) => {
            console.log(`[Mutation Success] Check completed for website ${websiteId}, received result:`, newCheckResult);

            // --- Optimistic Update using setQueriesData ---
            // *** FIX: Explicitly type the QueryFilters with the expected data type ***
            const detailsQueryFilter: QueryFilters<WebsiteDetailsData> = {
                queryKey: [...monitoringQueryKeys.all, 'details', websiteId],
                type: 'active',
                exact: false,
            };

            console.log(`[setQueriesData] Attempting immediate update for active queries matching prefix: ${JSON.stringify(detailsQueryFilter.queryKey)}`);

            // Pass the correctly typed filter
            queryClient.setQueriesData<WebsiteDetailsData>(detailsQueryFilter, (oldData) => {
                if (!oldData) {
                     console.log("[setQueriesData] No old data for this specific active query, skipping update.");
                     return undefined;
                }

                console.log(`[setQueriesData] Updating cache for an active details query...`, oldData);
                const OPTIMISTIC_LIMIT = 10;
                const updatedRecentChecks = [newCheckResult, ...(oldData.recentChecks ?? [])].slice(0, OPTIMISTIC_LIMIT);

                return {
                    ...oldData,
                    latestResult: newCheckResult,
                    recentChecks: updatedRecentChecks,
                };
            });
            // --- End Optimistic Update ---


            // --- Invalidation (Focus on Correctness) ---
            console.log(`[Invalidation] Invalidating data related to website ${websiteId} for user ${userId}`);

            const detailsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern, exact: false });
            console.log(`Invalidating ALL details for website ${websiteId}:`, detailsKeyPattern);

            const websiteStatsPrefix: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.invalidateQueries({ queryKey: websiteStatsPrefix, exact: false });
            console.log(`Invalidating website stats for website ${websiteId}, user ${userId}:`, websiteStatsPrefix);

            const userResultsPrefix: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
            queryClient.invalidateQueries({ queryKey: userResultsPrefix, exact: false });
            console.log(`Invalidating user results for user ${userId}:`, userResultsPrefix);

            const userStatsPrefix: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];
            queryClient.invalidateQueries({ queryKey: userStatsPrefix, exact: false });
            console.log(`Invalidating overall user stats for user ${userId}:`, userStatsPrefix);

            console.log(`[Invalidation Complete]`);
            // --- End Invalidation ---

        },
        onError: (error: ApiError, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message || error);
            // TODO: Consider showing a toast/notification to the user
        },
    });
}

// ... (Rest of the hooks remain unchanged) ...

/**
 * Hook to fetch overall statistics for the user dashboard.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query")); // Or ApiError
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.websiteStats(websiteId, period, userId);
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query")); // Or ApiError
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 10,
        ...options,
    });
}

/**
 * Hook to fetch all monitoring results for the user.
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: CustomQueryOptions<MonitoringResult[]>) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.userResults(limit, userId);

    return useQuery<MonitoringResult[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
             if (!userId) return Promise.resolve([]);
             return fetchAllUserMonitoringResults(limit);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000 * 15,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}