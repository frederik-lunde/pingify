// client/src/hooks/api/useMonitoring.ts
// No changes needed in this file.

import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey,
    QueryFilters
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    fetchAllUserMonitoringResults,
    fetchUserIncidentCountLast24h, // <-- Import the new fetcher
    FetchWebsiteDetailsParams,
    fetchDownWebsitesLast24h,
} from '../../api/monitoringApi';
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey,
    IncidentCountResponse // <-- Import type
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { alertQueryKeys } from './useAlerts'; // Keep for alert invalidation on check

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
    // --- NEW KEY FOR THE MONITORING-BASED INCIDENT COUNT ---
    incidentCountLast24h: (userId: number | undefined) =>
        [...monitoringQueryKeys.all, 'incidentCount', 'last24h', { userId }] as const,
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
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params);
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}

export const useDownWebsitesLast24h = () => {
    return useQuery({
        queryKey: ['downWebsitesLast24h'],
        queryFn: () => fetchDownWebsitesLast24h(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

/**
 * Hook for triggering an immediate website check (mutation).
 * Invalidates the new monitoring-based incident count.
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
            console.log(`[Mutation Success] Check completed for website ${websiteId}`);
            // --- Optimistic Update ---
            const detailsQueryFilter: QueryFilters<WebsiteDetailsData> = { queryKey: [...monitoringQueryKeys.all, 'details', websiteId], type: 'active', exact: false };
            queryClient.setQueriesData<WebsiteDetailsData>(detailsQueryFilter, (oldData) => {
                if (!oldData) return undefined;
                console.log(`[setQueriesData] Updating cache for details query...`);
                const updatedRecentChecks = [newCheckResult, ...(oldData.recentChecks ?? [])].slice(0, 10);
                const isDown = !newCheckResult.isAvailable;
                const updatedDowntimeInfo = isDown ? { consecutiveFailures: (oldData.consecutiveFailures ?? 0) + 1, downtimeStartedAt: oldData.downtimeStartedAt ?? newCheckResult.checkedAt } : { consecutiveFailures: undefined, downtimeStartedAt: null };
                return { ...oldData, latestResult: newCheckResult, recentChecks: updatedRecentChecks, ...updatedDowntimeInfo };
            });
            // --- End Optimistic Update ---

            // --- Invalidation (Includes NEW Incident Count) ---
            console.log(`[Invalidation] Invalidating data related to website ${websiteId} for user ${userId}`);
            const detailsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId];
            queryClient.invalidateQueries({ queryKey: detailsKeyPattern, exact: false });
            const websiteStatsPrefix: QueryKey = monitoringQueryKeys.websiteStats(websiteId, '', userId); // Use base key pattern
            queryClient.invalidateQueries({ queryKey: websiteStatsPrefix, exact: false });
            const userResultsPrefix: QueryKey = monitoringQueryKeys.userResults(undefined, userId);
            queryClient.invalidateQueries({ queryKey: userResultsPrefix, exact: false });
            const userStatsPrefix: QueryKey = monitoringQueryKeys.userStats('', userId); // Use base key pattern
            queryClient.invalidateQueries({ queryKey: userStatsPrefix, exact: false });

            // *** INVALIDATE THE NEW MONITORING-BASED INCIDENT COUNT ***
            const incidentCountKey: QueryKey = monitoringQueryKeys.incidentCountLast24h(userId);
            queryClient.invalidateQueries({ queryKey: incidentCountKey });
            console.log(`Invalidating monitoring incident count:`, incidentCountKey);
            // --- End NEW Incident Count Invalidation ---

            // --- Invalidate Alert-related queries (as before) ---
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists(), exact: false });
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats(), exact: false });
            console.log(`Invalidating alerts`);
            // --- End Alert Invalidation ---

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
    const userId = user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000,
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
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 1000,
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
        staleTime: 1000,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}


// Default cache times for the new hook
const DEFAULT_MONITORING_INCIDENT_COUNT_STALE_TIME = 1000 * 60 * 2; // 2 minutes
const DEFAULT_MONITORING_INCIDENT_COUNT_GC_TIME = 1000 * 60 * 10; // 10 minutes

/**
 * NEW Hook: Fetches the count of distinct websites with monitoring incidents
 * (down or slow based on user threshold) in the last 24 hours.
 */
export function useUserIncidentCountQuery(
    options?: CustomQueryOptions<IncidentCountResponse>
) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = monitoringQueryKeys.incidentCountLast24h(userId);

    return useQuery<IncidentCountResponse, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
             if (!userId) return Promise.resolve({ incidentCount: 0 }); // Return default if no user
             return fetchUserIncidentCountLast24h();
        },
        // --- React Query Options ---
        enabled: options?.enabled === undefined ? !!userId : options.enabled, // Enable if user exists
        refetchInterval: options?.refetchInterval, // Allow component override
        staleTime: options?.staleTime ?? DEFAULT_MONITORING_INCIDENT_COUNT_STALE_TIME,
        gcTime: options?.gcTime ?? DEFAULT_MONITORING_INCIDENT_COUNT_GC_TIME,
        // Start with undefined to clearly indicate loading state vs loaded zero
        initialData: undefined,
    });
}