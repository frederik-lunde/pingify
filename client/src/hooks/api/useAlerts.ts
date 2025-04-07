// src/hooks/query/useAlerts.ts
import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from "../../types"; // Adjust path
import {
    fetchUserAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    dismissAlert as dismissAlertAPI
} from '../../api/alertApi'; // Adjust path

// --- Query Keys --- (remain the same)
export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions = {}) => [...alertQueryKeys.lists(), 'user', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days?: number) => [...alertQueryKeys.all, 'stats', 'user', { days }] as const,
};

// --- Custom Hook Options Interface ---
// Define options the CALLING component might typically control
interface UseAlertsHookOptions {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number; // Allow overriding default staleTime if needed
    // gcTime is usually best set as a default inside the hook
}

// Default cache times (can be adjusted)
const DEFAULT_LIST_STALE_TIME = 1000 * 60; // 1 minute
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 5; // 5 minutes
const DEFAULT_STATS_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const DEFAULT_STATS_GC_TIME = 1000 * 60 * 15; // 15 minutes

// --- Query Hooks ---

/**
 * Hook to fetch the authenticated user's active alerts.
 * Encapsulates default caching, allows component to control enabled/refetchInterval.
 */
export function useUserAlertsQuery(
    // 1st arg: API filter options
    apiOptions: AlertQueryOptions = {},
    // 2nd arg: Options for the hook wrapper / query behavior control
    hookOptions?: UseAlertsHookOptions
) {
    const queryKey = alertQueryKeys.list(apiOptions);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserAlerts(apiOptions),
        // --- React Query Options ---
        // Controlled primarily by the component via hookOptions:
        enabled: hookOptions?.enabled, // Let component enable/disable
        refetchInterval: hookOptions?.refetchInterval, // Let component control polling
        // Defaults defined here, but overrideable via hookOptions:
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        // Defaults defined here (less likely to be overridden):
        gcTime: DEFAULT_LIST_GC_TIME,
        initialData: [], // Provide initial data
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
            // Should not run if not enabled, but check defensively
            if (!websiteId) return Promise.resolve([]);
            return fetchWebsiteAlerts(websiteId, apiOptions);
        },
        // --- React Query Options ---
        enabled: isQueryEnabled, // Derived enabled state
        refetchInterval: hookOptions?.refetchInterval, // Controlled by component
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME, // Default + override
        gcTime: DEFAULT_LIST_GC_TIME, // Default
        initialData: [],
    });
}

/**
 * Hook to fetch the authenticated user's alert statistics.
 */
export function useAlertStatsQuery(
    days = 7,
    hookOptions?: UseAlertsHookOptions // Can still pass enabled/staleTime etc.
) {
    const queryKey = alertQueryKeys.stats(days);
    return useQuery<AlertStats, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchAlertStats(days),
        // --- React Query Options ---
        enabled: hookOptions?.enabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_STATS_STALE_TIME, // Use stats default
        gcTime: DEFAULT_STATS_GC_TIME, // Use stats default
        initialData: () => ({ totalAlerts: 0, byType: {}, byWebsite: [] }),
    });
}



interface AlertDismissMutationContext {
    queryKey: QueryKey;
    previousAlerts?: Alert[];
}

export function useAlertActions() {
    const queryClient = useQueryClient();
    const userAlertListsQueryKeyPattern = alertQueryKeys.list();

    const dismissAlertMutation = useMutation<void, ApiError, number, AlertDismissMutationContext | undefined>({
        mutationFn: dismissAlertAPI,
        onMutate: async (): Promise<AlertDismissMutationContext | undefined> => {
            await queryClient.cancelQueries({ queryKey: userAlertListsQueryKeyPattern });
            // Using simpler invalidation strategy - no optimistic update here
            return undefined;
        },
         onError: (error, alertId, ) => {
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
            queryClient.invalidateQueries({ queryKey: userAlertListsQueryKeyPattern });
        },
        onSettled: (data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
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