/*
client/src/hooks/api/useMonitoring.ts
*/
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryFilters // Keep QueryFilters import
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    fetchAllUserMonitoringResults,
    FetchWebsiteDetailsParams,
} from '../../api/monitoringApi';
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey,
} from '../../types';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
import { incidentQueryKeys } from './useIncidents';
import { alertQueryKeys } from './useAlerts';
import { websiteQueryKeys } from './useWebsites';

// --- Query Keys ---
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    details: (params: FetchWebsiteDetailsParams, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, ...params }] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    userStats: (period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    userResults: (limit: number | undefined, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,
};

// --- Helper type ---
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook to fetch detailed data for the Website Details page.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    // --- Now correctly passes string | undefined ---
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // userId check remains valid
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
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined

    // Define patterns for invalidation (these key generators now accept string | undefined)
    const userIncidentListKeyPattern = incidentQueryKeys.list({}, userId);
    const userIncidentCountKey = incidentQueryKeys.countLast24h(userId);
    const userStatsKeyPattern = monitoringQueryKeys.userStats('', userId); // Match any period
    const userWebsiteListKeyPattern = websiteQueryKeys.lists(userId);

    return useMutation<MonitoringResult, ApiError, number>({
        mutationFn: (websiteId: number) => {
             if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
                return Promise.reject(new Error("Invalid Website ID provided."));
            }
            return triggerWebsiteCheck(websiteId);
        },
        onSuccess: (websiteId) => {
            console.log(`[Mutation Success] Check completed for website ${websiteId}`);
            console.log(`[Invalidation] Invalidating data related to website ${websiteId} for user ${userId} after check...`);

            // Invalidation logic uses the updated key generators implicitly
            const detailsKeyPattern: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern, exact: false });
            console.log(`Invalidating monitoring details:`, detailsKeyPattern);

            const websiteStatsKeyPattern: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'stats', 'website', websiteId];
            queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern, exact: false });
            console.log(`Invalidating website stats:`, websiteStatsKeyPattern);

            queryClient.invalidateQueries({ queryKey: userStatsKeyPattern, exact: false });
            console.log(`Invalidating user overall stats:`, userStatsKeyPattern);

            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId), exact: false });
            console.log(`Invalidating user monitoring results list`);

            queryClient.invalidateQueries({ queryKey: userWebsiteListKeyPattern });
            console.log(`Invalidating user website list:`, userWebsiteListKeyPattern);

            queryClient.invalidateQueries({ queryKey: userIncidentListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userIncidentCountKey });
            console.log(`Invalidating user incidents list and count`);

            queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists(), exact: false });
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats(), exact: false });
            console.log(`Invalidating user alerts list and stats`);

            console.log(`[Invalidation Complete]`);
        },
        onError: (error: ApiError, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message || error);
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined

    return useQuery<OverallStats, ApiError>({
        // --- Now correctly passes string | undefined ---
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 60 * 1000,
        gcTime: 1000 * 60 * 15,
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    // --- Now correctly passes string | undefined ---
    const queryKey = monitoringQueryKeys.websiteStats(websiteId, period, userId);
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 60 * 1000,
        gcTime: 1000 * 60 * 10,
        ...options,
    });
}

/**
 * Hook to fetch all monitoring results for the user.
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: CustomQueryOptions<MonitoringResult[]>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    // --- Now correctly passes string | undefined ---
    const queryKey = monitoringQueryKeys.userResults(limit, userId);

    return useQuery<MonitoringResult[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
             if (!userId) return Promise.resolve([]);
             return fetchAllUserMonitoringResults(limit);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 60 * 1000,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}