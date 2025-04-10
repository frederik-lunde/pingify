// client/src/hooks/query/useAlerts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from "../../types";
import {
    fetchUserAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    dismissAlert as dismissAlertAPI
} from '../../api/alertApi';

export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions = {}) => [...alertQueryKeys.lists(), 'user', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days?: number) => [...alertQueryKeys.all, 'stats', 'user', { days }] as const,
};

interface UseAlertsHookOptions {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
}

// Default cache times
const DEFAULT_LIST_STALE_TIME = 1000;
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 5;
const DEFAULT_STATS_STALE_TIME = 1000;
const DEFAULT_STATS_GC_TIME = 1000 * 60 * 15;


/**
 * Hook to fetch the authenticated user's active alerts.
 */
export function useUserAlertsQuery(
    apiOptions: AlertQueryOptions = {},
    hookOptions?: UseAlertsHookOptions
) {
    const queryKey = alertQueryKeys.list(apiOptions);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserAlerts(apiOptions),
        enabled: hookOptions?.enabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: DEFAULT_LIST_GC_TIME,
        initialData: [],
    });
}

/**
 * Hook to fetch active alerts for a specific website.
 */
export function useWebsiteAlertsQuery(
    websiteId: number | undefined,
    apiOptions: AlertQueryOptions = {},
    hookOptions?: UseAlertsHookOptions
) {
    const queryKey = alertQueryKeys.website(websiteId, apiOptions);
    const isQueryEnabled = (hookOptions?.enabled ?? true) && typeof websiteId === 'number' && websiteId > 0;

    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!websiteId) return Promise.resolve([]);
            return fetchWebsiteAlerts(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: DEFAULT_LIST_GC_TIME,
        initialData: [],
    });
}

/**
 * Hook to fetch the authenticated user's alert statistics.
 */
export function useAlertStatsQuery(
    days = 7,
    hookOptions?: UseAlertsHookOptions
) {
    const queryKey = alertQueryKeys.stats(days);
    return useQuery<AlertStats, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchAlertStats(days),
        enabled: hookOptions?.enabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_STATS_STALE_TIME,
        gcTime: DEFAULT_STATS_GC_TIME,
        initialData: () => ({ totalAlerts: 0, byType: {}, byWebsite: [] }),
    });
}


/**
 * Hook providing mutation functions for alert actions (e.g., dismissing).
 */
export function useAlertActions() {
    const queryClient = useQueryClient();
    const userAlertListsQueryKeyPattern = alertQueryKeys.list();

    // Removed unused context type from useMutation signature
    const dismissAlertMutation = useMutation<void, ApiError, number>({
        mutationFn: dismissAlertAPI,
         onError: (error, alertId) => {
            // Log error, invalidation happens in onSettled
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
        },
        // onSettled will run regardless of success or error
        onSettled: (data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            // Invalidate relevant queries after the mutation attempt
            queryClient.invalidateQueries({ queryKey: userAlertListsQueryKeyPattern });
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats() });
        },
    });

    return {
        dismissAlert: dismissAlertMutation.mutate,
        dismissAlertAsync: dismissAlertMutation.mutateAsync,
        isDismissingAlert: dismissAlertMutation.isPending,
        errorDismissingAlert: dismissAlertMutation.error,
    };
}