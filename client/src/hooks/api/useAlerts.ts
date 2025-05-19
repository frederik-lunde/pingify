import { useQuery, useMutation, useQueryClient, UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from "../../types";
import {
    fetchUserAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    dismissAlert as dismissAlertAPI
} from '../../api/alertApi';

/**
 * Defines query keys for alert-related data.
 */
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
    gcTime?: number;
}

const DEFAULT_LIST_STALE_TIME = 1000 * 30;
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 5;
const DEFAULT_STATS_STALE_TIME = 1000 * 60 * 5;
const DEFAULT_STATS_GC_TIME = 1000 * 60 * 15;


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
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        initialData: [],
    });
}


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
            if (!websiteId) {
                console.warn("useWebsiteAlertsQuery called without valid websiteId");
                return Promise.resolve([]);
            }
            return fetchWebsiteAlerts(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        initialData: [],
    });
}

/**
 * Custom hook to fetch alert statistics with TanStack Query.
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
        gcTime: hookOptions?.gcTime ?? DEFAULT_STATS_GC_TIME,
        initialData: () => ({ totalAlerts: 0, byType: {}, byWebsite: [] }),
    });
}

interface UseAlertActionsReturn {
    dismissAlert: UseMutateFunction<void, ApiError, number, unknown>;
    dismissAlertAsync: UseMutateAsyncFunction<void, ApiError, number, unknown>;
    isDismissingAlert: boolean;
    errorDismissingAlert: ApiError | null;
}

/**
 * Custom hook providing mutation functions for alert actions (e.g., dismiss).
 */
export function useAlertActions(): UseAlertActionsReturn {
    const queryClient = useQueryClient();
    const userAlertListsQueryKeyPattern = alertQueryKeys.lists();
    const userAlertStatsQueryKeyPattern = alertQueryKeys.stats();

    const dismissAlertMutation = useMutation<void, ApiError, number>({
        mutationFn: dismissAlertAPI,
         onSuccess: (_data, alertId) => {
            console.log(`Alert ${alertId} dismissed successfully.`);
         },
         onError: (error, alertId) => {
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
        },
        onSettled: (_data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            queryClient.invalidateQueries({ queryKey: userAlertListsQueryKeyPattern, refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: userAlertStatsQueryKeyPattern, refetchType: 'active' });
        },
    });

    return {
        dismissAlert: dismissAlertMutation.mutate,
        dismissAlertAsync: dismissAlertMutation.mutateAsync,
        isDismissingAlert: dismissAlertMutation.isPending,
        errorDismissingAlert: dismissAlertMutation.error,
    };
}