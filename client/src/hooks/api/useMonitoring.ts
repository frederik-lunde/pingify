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
    // fetchUserIncidentCountLast24h, // Removed
    FetchWebsiteDetailsParams,
    // fetchDownWebsitesLast24h, // Removed
} from '../../api/monitoringApi';
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey,
    // IncidentCountResponse, // Removed
    // DownWebsite // Removed
} from '../../types';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
// --- Import incident keys for invalidation ---
import { incidentQueryKeys } from './useIncidents';
import { alertQueryKeys } from './useAlerts'; // Keep for alert invalidation
// --- Import website keys for invalidation ---
import { websiteQueryKeys } from './useWebsites';

// --- Query Keys ---
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
    // --- REMOVED: incidentCountLast24h ---
    // --- REMOVED: downWebsitesLast24h ---
};

// --- Helper type ---
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook to fetch detailed data for the Website Details page.
 * UPDATED: Uses the new WebsiteDetailsData type.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            // API function now returns data including incidents
            return fetchWebsiteDetails(params);
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30, // Stale after 30 seconds
        gcTime: 1000 * 60 * 5, // Garbage collect after 5 minutes
        ...options,
    });
}

// --- REMOVED: useDownWebsitesLast24h ---

/**
 * Hook for triggering an immediate website check (mutation).
 * UPDATED: Invalidation logic now includes incident queries.
 * UPDATED: Removed optimistic update for downtime info.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id;

    // Define patterns for invalidation
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
        onSuccess: (newCheckResult, websiteId) => {
            console.log(`[Mutation Success] Check completed for website ${websiteId}`);

            // --- Invalidation ---
            console.log(`[Invalidation] Invalidating data related to website ${websiteId} for user ${userId} after check...`);

            // Invalidate details for this specific website (will refetch with new result and potentially updated incident status)
            const detailsKeyPattern: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern, exact: false }); // Invalidate any timeframe/limit for this website detail
            console.log(`Invalidating monitoring details:`, detailsKeyPattern);

            // Invalidate website-specific stats (uptime, avg response, incident counts for period might change)
            const websiteStatsKeyPattern: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'stats', 'website', websiteId];
            queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern, exact: false });
            console.log(`Invalidating website stats:`, websiteStatsKeyPattern);

            // Invalidate user's overall stats (might change overall uptime, last incident etc.)
            queryClient.invalidateQueries({ queryKey: userStatsKeyPattern, exact: false });
            console.log(`Invalidating user overall stats:`, userStatsKeyPattern);

            // Invalidate user's monitoring results list
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId), exact: false });
            console.log(`Invalidating user monitoring results list`);

            // Invalidate user's website list (to update latestResult and currentIncident shown on cards)
            queryClient.invalidateQueries({ queryKey: userWebsiteListKeyPattern });
            console.log(`Invalidating user website list:`, userWebsiteListKeyPattern);

            // Invalidate user's incident list and count (new incident might start/end)
            queryClient.invalidateQueries({ queryKey: userIncidentListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userIncidentCountKey });
            console.log(`Invalidating user incidents list and count`);

            // Invalidate user's alert list and stats (alerts might be created/dismissed)
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists(), exact: false });
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats(), exact: false });
            console.log(`Invalidating user alerts list and stats`);

            console.log(`[Invalidation Complete]`);
        },
        onError: (error: ApiError, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message || error);
            // Optionally invalidate details on error too, in case the UI needs to reflect the failure
            // queryClient.invalidateQueries({ queryKey: [...monitoringQueryKeys.all, 'details', websiteId], exact: false });
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 * UPDATED: Uses the new OverallStats type.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            // API returns the updated OverallStats structure
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 60 * 1000, // Stale after 1 minute
        gcTime: 1000 * 60 * 15, // GC after 15 minutes
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 * UPDATED: Uses the new WebsiteStatsData type.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.websiteStats(websiteId, period, userId);
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            // API returns the updated WebsiteStatsData structure
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 60 * 1000, // Stale after 1 minute
        gcTime: 1000 * 60 * 10, // GC after 10 minutes
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
        staleTime: 60 * 1000, // Stale after 1 minute
        gcTime: 1000 * 60 * 5, // GC after 5 minutes
        ...options,
    });
}


// --- REMOVED: useUserIncidentCountQuery ---
// This is now handled by useUserIncidentCountLast24hQuery in useIncidents.ts