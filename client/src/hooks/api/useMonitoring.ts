import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions // <-- Import UseQueryOptions
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    fetchAllUserMonitoringResults,
    FetchWebsiteDetailsParams,
} from '../../api/monitoringApi'; // Adjust path
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStats,
    MonitoringResult,
    ApiError,
    TimeframeKey
} from '../../types'; // Adjust path

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    details: (params: FetchWebsiteDetailsParams) => [...monitoringQueryKeys.all, 'details', params.websiteId, params] as const,
    userStats: (period: TimeframeKey | string) => [...monitoringQueryKeys.all, 'stats', 'user', { period }] as const,
    websiteStats: (websiteId: number, period: TimeframeKey | string) => [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { period }] as const,
    userResults: (limit: number) => [...monitoringQueryKeys.all, 'userResults', { limit }] as const,
};

// Define the helper type here as well
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook to fetch detailed data for the Website Details page.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const queryKey = monitoringQueryKeys.details(params);
    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchWebsiteDetails(params),
        enabled: options?.enabled ?? (!!params.websiteId && params.websiteId > 0),
        ...options,
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    return useMutation< { message: string }, ApiError, number>({
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        onSuccess: (data, websiteId) => {
            console.log('Check triggered successfully:', data.message);
             queryClient.invalidateQueries({
                 predicate: query =>
                    (query.queryKey[0] === 'monitoring' && query.queryKey[1] === 'details' && query.queryKey[2] === websiteId) ||
                    (query.queryKey[0] === 'monitoring' && query.queryKey[1] === 'stats' && query.queryKey[3] === websiteId) ||
                    (query.queryKey[0] === 'monitoring' && query.queryKey[1] === 'userResults')
             });
        },
        onError: (error) => {
            console.error('Failed to trigger website check:', error.message);
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period),
        queryFn: () => fetchUserStats(period),
        staleTime: 1000 * 60 * 2,
        ...options,
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStats>) {
    return useQuery<WebsiteStats, ApiError>({
        queryKey: monitoringQueryKeys.websiteStats(websiteId!, period),
        queryFn: () => fetchWebsiteStats(websiteId!, period),
        enabled: options?.enabled ?? (!!websiteId && websiteId > 0),
        staleTime: 1000 * 60 * 2,
        ...options,
    });
}

/**
 * Hook to fetch all monitoring results for the user (used by useWebsiteData).
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: CustomQueryOptions<MonitoringResult[]>) {
    return useQuery<MonitoringResult[], ApiError>({
        queryKey: monitoringQueryKeys.userResults(limit),
        queryFn: () => fetchAllUserMonitoringResults(limit),
        // REMOVED initialData setting from here
        staleTime: 1000 * 30,
        ...options,
    });
}