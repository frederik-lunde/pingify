// src/hooks/api/useMonitoring.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats, // Keep if used elsewhere (e.g., Dashboard)
    fetchWebsiteStats, // Keep if used elsewhere
    fetchAllUserMonitoringResults, // Import the function for fetching all results
    FetchWebsiteDetailsParams,
} from '../../api/monitoringApi'; // Adjust path
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStats,
    MonitoringResult, // Added MonitoringResult type
    ApiError,
    TimeframeKey
} from '../../types'; // Adjust path

// Query Keys
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    details: (params: FetchWebsiteDetailsParams) => [...monitoringQueryKeys.all, 'details', params.websiteId, params] as const, // Include websiteId for easier invalidation
    userStats: (period: TimeframeKey | string) => [...monitoringQueryKeys.all, 'stats', 'user', { period }] as const,
    websiteStats: (websiteId: number, period: TimeframeKey | string) => [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { period }] as const,
    userResults: (limit: number) => [...monitoringQueryKeys.all, 'userResults', { limit }] as const, // Key for all user results
};

/**
 * Hook to fetch detailed data for the Website Details page.
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: { enabled?: boolean }) {
    const queryKey = monitoringQueryKeys.details(params);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchWebsiteDetails(params),
        enabled: options?.enabled ?? (!!params.websiteId && params.websiteId > 0), // Enable only if websiteId is valid
        // staleTime: 1000 * 30, // Consider 30 seconds stale time
    });
}

/**
 * Hook for triggering an immediate website check (mutation).
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();

    return useMutation< { message: string }, ApiError, number>({ // Result, Error, Variables (websiteId)
        mutationFn: (websiteId: number) => triggerWebsiteCheck(websiteId),
        onSuccess: (data, websiteId) => {
            console.log('Check triggered successfully:', data.message);
            // Invalidate queries related to the specific website's details and stats
            // Use invalidateQueries with a predicate for more robust invalidation
             queryClient.invalidateQueries({
                 predicate: query =>
                    (query.queryKey[0] === 'monitoring' && query.queryKey[1] === 'details' && query.queryKey[2] === websiteId) ||
                    (query.queryKey[0] === 'monitoring' && query.queryKey[1] === 'stats' && query.queryKey[3] === websiteId)
             });
            // Optionally invalidate dashboard-level data if the check immediately impacts it
            // queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userStats('week') }); // Example
            // queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(500) }); // Example
        },
        onError: (error) => {
            console.error('Failed to trigger website check:', error.message);
        },
    });
}

/**
 * Hook to fetch overall statistics for the user dashboard.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: { enabled?: boolean, refetchInterval?: number | false }) {
    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period),
        queryFn: () => fetchUserStats(period),
        enabled: options?.enabled,
        refetchInterval: options?.refetchInterval,
        staleTime: 1000 * 60 * 2, // Stats can be slightly stale (2 minutes)
    });
}

/**
 * Hook to fetch statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: { enabled?: boolean, refetchInterval?: number | false }) {
    return useQuery<WebsiteStats, ApiError>({
        queryKey: monitoringQueryKeys.websiteStats(websiteId!, period),
        queryFn: () => fetchWebsiteStats(websiteId!, period),
        enabled: options?.enabled ?? (!!websiteId && websiteId > 0), // Only run if websiteId is valid
        refetchInterval: options?.refetchInterval,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Hook to fetch all monitoring results for the user (used by useWebsiteData).
 * WARNING: Fetches potentially large amounts of data.
 */
export function useUserMonitoringResultsQuery(limit: number = 500, options?: { enabled?: boolean, refetchInterval?: number | false }) {
    return useQuery<MonitoringResult[], ApiError>({
        queryKey: monitoringQueryKeys.userResults(limit),
        queryFn: () => fetchAllUserMonitoringResults(limit),
        enabled: options?.enabled,
        refetchInterval: options?.refetchInterval,
        initialData: [], // Start with empty array
        staleTime: 1000 * 30, // Results can be slightly stale (30 seconds)
    });
}