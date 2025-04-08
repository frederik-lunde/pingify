// client/src/hooks/query/useAlerts.ts
import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from "../../types"; // IncidentCountResponse no longer needed
import {
    fetchUserAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    // fetchUserIncidentCountLast24h, // REMOVED import
    dismissAlert as dismissAlertAPI
} from '../../api/alertApi'; // Adjust path

// --- Query Keys ---
export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions = {}) => [...alertQueryKeys.lists(), 'user', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days?: number) => [...alertQueryKeys.all, 'stats', 'user', { days }] as const,
    // REMOVED: incidentCountLast24h key
};

// --- Custom Hook Options Interface ---
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

// --- Query Hooks ---

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
// REMOVED: useUserIncidentCountQuery hook


interface AlertDismissMutationContext {
    queryKey: QueryKey;
    previousAlerts?: Alert[];
}

/**
 * Hook providing mutation functions for alert actions (e.g., dismissing).
 */
export function useAlertActions() {
    const queryClient = useQueryClient();
    const userAlertListsQueryKeyPattern = alertQueryKeys.list();

    const dismissAlertMutation = useMutation<void, ApiError, number, AlertDismissMutationContext | undefined>({
        mutationFn: dismissAlertAPI,
        onMutate: async (): Promise<AlertDismissMutationContext | undefined> => {
            await queryClient.cancelQueries({ queryKey: userAlertListsQueryKeyPattern });
            return undefined;
        },
         onError: (error, alertId, ) => {
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
            queryClient.invalidateQueries({ queryKey: userAlertListsQueryKeyPattern });
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats() });
        },
        onSettled: (data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            // Invalidate lists and stats, but NOT the monitoring-based incident count
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