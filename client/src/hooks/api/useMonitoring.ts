//client\src\hooks\api\useMonitoring.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey // Import QueryKey type
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
    MonitoringResult,
    ApiError,
    TimeframeKey
} from '../../types'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // Adjust path as needed

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    // Details for a specific website (includes user ID for context)
    details: (params: FetchWebsiteDetailsParams, userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, timeframe: params.timeframe, limit: params.limit }] as const,
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
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params); // API should handle auth implicitly
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30, // Example: 30 seconds
        gcTime: 1000 * 60 * 5, // Example: 5 minutes
        ...options, // Spread any other options like refetchInterval, etc.
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 * Invalidates relevant monitoring data on success using partial keys.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id; // Needed for identifying user-specific data to invalidate

    return useMutation< { message: string }, ApiError, number>({
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        onSuccess: (data, websiteId) => {
            console.log(`[Mutation Success] Check triggered for website ${websiteId}:`, data.message);

            // --- Invalidation Strategy using Partial Keys ---

            // 1. Invalidate ALL details queries for this specific websiteId.
            //    This covers different timeframes/limits fetched for the details page.
            //    Structure: ['monitoring', 'details', websiteId]
            const detailsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern });
            console.log(`Invalidating details for website ${websiteId}:`, detailsKeyPattern);

            // 2. Invalidate ALL website-specific stats queries for this websiteId AND this userId.
            //    This covers different periods fetched for this specific website's stats.
            //    Structure: ['monitoring', 'stats', 'website', websiteId, { userId }]
            //    We create a partial key up to the userId part.
            const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern });
            console.log(`Invalidating website stats for website ${websiteId}, user ${userId}:`, websiteStatsKeyPattern);

            // 3. Invalidate ALL user results list queries for this userId.
            //    This covers lists with different limits.
            //    Structure: ['monitoring', 'userResults', { userId }]
            const userResultsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
            queryClient.invalidateQueries({ queryKey: userResultsKeyPattern });
            console.log(`Invalidating user results for user ${userId}:`, userResultsKeyPattern);


            // 4. Consider invalidating the user's OVERALL stats as well, as uptime/averages might change.
            //    Structure: ['monitoring', 'stats', 'user', { userId }]
            const userStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];
            queryClient.invalidateQueries({ queryKey: userStatsKeyPattern });
            console.log(`Invalidating overall user stats for user ${userId}:`, userStatsKeyPattern);


            console.log(`[Invalidation Complete] Monitoring data related to website ${websiteId} for user ${userId}`);
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
        staleTime: 1000 * 60 * 5, // Example: 5 minutes stale time
        gcTime: 1000 * 60 * 15, // Example: 15 minutes cache time
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
        staleTime: 1000 * 60 * 2, // Example: 2 minutes stale time
        gcTime: 1000 * 60 * 10, // Example: 10 minutes cache time
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
        staleTime: 1000 * 15, // Results change often, maybe shorter stale time (15s example)
        gcTime: 1000 * 60 * 5, // Cache time 5 mins
        ...options,
    });
}