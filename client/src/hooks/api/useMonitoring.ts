//client\src\hooks\api\useMonitoring.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions
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
import { useAuth } from '../../context/AuthContext'; // <--- IMPORT useAuth (ADJUST PATH AS NEEDED)

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    // Add userId to relevant keys
    details: (params: FetchWebsiteDetailsParams, userId: number | undefined) => [...monitoringQueryKeys.all, 'details', params.websiteId, { userId }, params] as const,
    userStats: (period: TimeframeKey | string, userId: number | undefined) => [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: number | undefined) => [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    userResults: (limit: number | undefined, userId: number | undefined) => [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,
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
 * Invalidates relevant user-specific monitoring data on success.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Get userId for invalidations
    const userId = user?.id;

    return useMutation< { message: string }, ApiError, number>({
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        onSuccess: (data, websiteId) => {
            console.log('Check triggered successfully:', data.message);

            // Invalidate data related to this specific website FOR THIS USER
            // and the overall user results list.
            // Use invalidateQueries with more specific keys using the known userId.

            // Example: Invalidate website details (requires params, might be tricky - broader invalidation might be easier)
            // A simple approach: invalidate all details queries for this websiteId, regardless of params/user?
             queryClient.invalidateQueries({ queryKey: ['monitoring', 'details', websiteId] });

            // Invalidate specific website stats for the current user and all periods
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.websiteStats(websiteId, undefined, userId).slice(0, 4) }); // Invalidate ['monitoring', 'stats', 'website', websiteId] for this user

            // Invalidate the user's overall monitoring results list
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId).slice(0, 3) }); // Invalidate ['monitoring', 'userResults', { userId }]

            // Consider invalidating userStats too if a check impacts overall numbers
            // queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userStats(undefined, userId).slice(0, 4) });

            console.log(`Invalidated monitoring data for website ${websiteId} and user ${userId}`);
        },
        onError: (error) => {
            console.error('Failed to trigger website check:', error.message);
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 * Includes userId in the query key.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<OverallStats, ApiError>({
        // Use updated key with userId
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            // Guard against missing userId
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period); // API uses token
        },
        // Enable only if userId exists
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 0,
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 * Includes userId in the query key.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<WebsiteStatsData, ApiError>({
        // Use updated key with websiteId, period, and userId
        queryKey: monitoringQueryKeys.websiteStats(websiteId, period, userId),
        queryFn: () => {
            // Guard against missing IDs
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period); // API uses token + path params
        },
        // Enable only if both IDs are valid
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        staleTime: 1000 * 60 * 2,
        ...options,
    });
}

/**
 * Hook to fetch all monitoring results for the user (used by useWebsiteData).
 * Includes userId in the query key.
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: CustomQueryOptions<MonitoringResult[]>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<MonitoringResult[], ApiError>({
        // Use updated key with limit and userId
        queryKey: monitoringQueryKeys.userResults(limit, userId),
        queryFn: () => {
             // Guard against missing userId
             if (!userId) return Promise.resolve([]); // Return empty or reject
             return fetchAllUserMonitoringResults(limit); // API uses token
        },
        // Enable only if userId exists
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 0, // Results potentially change often
        ...options,
    });
}