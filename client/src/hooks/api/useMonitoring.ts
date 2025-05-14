// src/hooks/api/useMonitoring.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryFilters // Keep QueryFilters if used elsewhere, though not directly in the fix
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    FetchWebsiteDetailsParams,
    // Assuming you might have an API function like:
    // fetchMonitoringResultsForWebsite, (if not, this key might be for invalidation only)
} from '../../api/monitoringApi';
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { incidentQueryKeys } from './useIncidents';
import { alertQueryKeys } from './useAlerts';
import { websiteQueryKeys } from './useWebsites';

/**
 * Defines query keys for monitoring-related data.
 */
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    details: (params: FetchWebsiteDetailsParams, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, ...params }] as const,
    userStats: (period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    
    // For all monitoring results aggregated at the user level (if you have such a query)
    userResults: (limit: number | undefined, userId: string | undefined) => // This key seems to be for user-level aggregated/listed results
        [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,

    // ADDED: Key for monitoring results of a SPECIFIC website
    // This is the key that was missing for the useWebsiteMutations.ts invalidation logic
    websiteResults: (websiteId: number | undefined, userId?: string | undefined, params?: { limit?: number, from?: string, to?: string }) =>
        [...monitoringQueryKeys.all, 'websiteResults', websiteId, { userId, ...params }] as const,
};

type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Custom hook to fetch detailed information for a specific website.
 * (This fetches WebsiteDetailsData, which includes recent checks, but is a different query key)
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params); // This fetches the comprehensive WebsiteDetailsData
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30, // 30 seconds
        gcTime: 1000 * 60 * 5,  // 5 minutes
        ...options,
    });
}

// If you need a hook specifically for fetching *only* the list of MonitoringResult[] for a website,
// you would add it here, using `monitoringQueryKeys.websiteResults`.
// For example:
/*
export function useMonitoringResultsForWebsiteQuery(
    websiteId: number,
    params?: { limit?: number, from?: string, to?: string },
    options?: CustomQueryOptions<MonitoringResult[]>
) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    // Assume you have an API function: fetchMonitoringResultsForWebsite(websiteId, params)
    return useQuery<MonitoringResult[], ApiError>({
        queryKey: monitoringQueryKeys.websiteResults(websiteId, userId, params),
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID"));
            // return fetchMonitoringResultsForWebsite(websiteId, params);
            return Promise.resolve([]); // Placeholder if API doesn't exist yet
        },
        enabled: !!userId && !!websiteId && (options?.enabled === undefined ? true : options.enabled),
        ...options,
    });
}
*/


/**
 * Custom hook for triggering an on-demand check for a website.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const userId = auth?.user?.id;

    // Define query key patterns for invalidation
    const userIncidentListKeyPattern = incidentQueryKeys.list({}, userId); // Assuming list takes params and userId
    const userIncidentCountKey = incidentQueryKeys.countLast24h(userId);
    const userOverallStatsKeyPattern = monitoringQueryKeys.userStats('week', userId); // Use a common default or make dynamic
    const userWebsiteListKeyPattern = websiteQueryKeys.lists(userId);


    return useMutation<MonitoringResult, ApiError, number>({ // Expects websiteId as input
        mutationFn: (websiteId: number) => {
             if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
                return Promise.reject(new Error("Invalid Website ID provided."));
            }
            return triggerWebsiteCheck(websiteId);
        },
        // The first argument to onSuccess is the data returned by mutationFn (MonitoringResult)
        // The second argument is the variables passed to mutate/mutateAsync (websiteId)
        onSuccess: (data, websiteId) => { // Corrected: 'data' is the MonitoringResult, 'websiteId' is the variable
            if (userId) {
                console.log(`Check successful for website ${websiteId}, invalidating relevant queries.`);
                // Invalidate details for the specific website (if params are known or use a broader pattern)
                // For broader invalidation of details containing this websiteId:
                const detailsKeyPrefix: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'details', websiteId];
                queryClient.invalidateQueries({ queryKey: detailsKeyPrefix, exact: false });

                // Invalidate stats for the specific website (if period is known or use a broader pattern)
                const websiteStatsKeyPrefix: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'stats', 'website', websiteId];
                queryClient.invalidateQueries({ queryKey: websiteStatsKeyPrefix, exact: false });

                // Invalidate specific monitoring results for this website
                queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.websiteResults(websiteId, userId), exact: false });


                // Invalidate user-level stats and results
                queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern, exact: false }); // More specific
                queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId), exact: false });


                queryClient.invalidateQueries({ queryKey: userWebsiteListKeyPattern }); // User's list of websites
                queryClient.invalidateQueries({ queryKey: userIncidentListKeyPattern, exact: false });
                queryClient.invalidateQueries({ queryKey: userIncidentCountKey });
                queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists(), exact: false }); // User's alerts
                queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats(), exact: false }); // User's alert stats
            } else {
                console.warn("[Invalidation Skipped] User ID not available, cannot invalidate user-specific caches.");
            }
        },
        onError: (error: ApiError, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message || error);
        },
    });
}

/**
 * Custom hook to fetch overall monitoring statistics for the user.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const auth = useAuth();
    const userId = auth?.user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 60 * 1000, // 1 minute
        gcTime: 1000 * 60 * 15, // 15 minutes
        ...options,
    });
}

/**
 * Custom hook to fetch monitoring statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const auth = useAuth();
    const userId = auth?.user?.id; // Get userId for the query key
    const queryKey = monitoringQueryKeys.websiteStats(websiteId, period, userId);
    // Enable query only if userId and websiteId are present and websiteId is valid
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 60 * 1000, // 1 minute
        gcTime: 1000 * 60 * 10, // 10 minutes
        ...options,
    });
}