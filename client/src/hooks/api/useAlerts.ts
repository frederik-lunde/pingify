// src/hooks/api/useAlerts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, AlertUser, ApiError } from "../../types"; // Adjust path
// Import API functions directly
import {
    fetchUserAlerts,
    fetchUserUnreadAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    markAlertAsRead as markAlertAsReadAPI,
    markAllAlertsAsRead as markAllAlertsAsReadAPI
} from '../../api/alertApi'; // Adjust path

// --- Query Keys ---
export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions) => [...alertQueryKeys.lists(), options] as const,
    userUnread: (options: AlertQueryOptions) => [...alertQueryKeys.all, 'user', 'unread', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days: number) => [...alertQueryKeys.all, 'stats', { days }] as const,
};

// --- Query Hooks ---

/**
 * Hook for fetching user's alerts.
 */
export function useUserAlertsQuery(options: AlertQueryOptions = {}, queryOptions?: { enabled?: boolean, refetchInterval?: number | false }) {
    const queryKey = alertQueryKeys.list(options);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserAlerts(options),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
    });
}

/**
 * Hook for fetching unread alerts for the user.
 */
export function useUserUnreadAlertsQuery(options: AlertQueryOptions = {}, queryOptions?: { enabled?: boolean, refetchInterval?: number | false }) {
    const queryKey = alertQueryKeys.userUnread(options);
    return useQuery<AlertUser[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserUnreadAlerts(options),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
        initialData: [], // Keep initial data as empty array
    });
}

/**
 * Hook for fetching alerts for a specific website.
 */
export function useWebsiteAlertsQuery(websiteId: number | undefined, options: AlertQueryOptions = {}, queryOptions?: { enabled?: boolean, refetchInterval?: number | false }) {
    const queryKey = alertQueryKeys.website(websiteId, options);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchWebsiteAlerts(websiteId!, options), // Assert non-null as enabled handles undefined
        enabled: queryOptions?.enabled ?? (!!websiteId && websiteId > 0), // Enable if websiteId is valid
        refetchInterval: queryOptions?.refetchInterval,
    });
}

/**
 * Hook for fetching alert statistics for the user.
 */
export function useAlertStatsQuery(days = 7, queryOptions?: { enabled?: boolean, refetchInterval?: number | false }) {
    const queryKey = alertQueryKeys.stats(days);
    return useQuery<AlertStats, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchAlertStats(days),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
        staleTime: 1000 * 60 * 5, // Stats might not need frequent updates
    });
}

// --- Mutation Hooks ---

/**
 * Hook providing mutations for marking alerts as read.
 */
export function useAlertReadMutations() {
    const queryClient = useQueryClient();

    // Mutation to mark a single alert as read
    const markOneAsReadMutation = useMutation<void, ApiError, number>({
        mutationFn: markAlertAsReadAPI,
        onSuccess: (_, alertId) => {
            // Optimistic Update: Immediately remove from unread cache
            queryClient.setQueryData<AlertUser[]>(
                alertQueryKeys.userUnread({}), // Assume base options for unread list
                (oldData) => (oldData ?? []).filter(alertUser => alertUser.alertId !== alertId)
            );
            // Also, invalidate to ensure consistency if optimistic fails or other views exist
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.userUnread({}) });
            console.log(`Alert ${alertId} marked as read`);
        },
        onError: (error, alertId) => {
            console.error(`Failed to mark alert ${alertId} as read:`, error.message);
            // Invalidate on error to rollback optimistic update and fetch server state
             queryClient.invalidateQueries({ queryKey: alertQueryKeys.userUnread({}) });
        },
    });

    // Mutation to mark all alerts as read
    const markAllAsReadMutation = useMutation<void, ApiError, void>({
        mutationFn: markAllAlertsAsReadAPI,
        onSuccess: () => {
            // Optimistic Update: Set all unread query data to empty array
            queryClient.setQueriesData<AlertUser[]>({ queryKey: alertQueryKeys.userUnread({}) }, () => []);
            // Also invalidate
            queryClient.invalidateQueries({ queryKey: alertQueryKeys.userUnread({}) });
            console.log("All alerts marked as read");
        },
         onError: (error) => {
            console.error("Failed to mark all alerts as read:", error.message);
             queryClient.invalidateQueries({ queryKey: alertQueryKeys.userUnread({}) });
        },
    });

    return {
        markAsRead: markOneAsReadMutation.mutate,
        markAsReadAsync: markOneAsReadMutation.mutateAsync,
        markAllAsRead: markAllAsReadMutation.mutate,
        markAllAsReadAsync: markAllAsReadMutation.mutateAsync,
        isMarkingOne: markOneAsReadMutation.isPending,
        isMarkingAll: markAllAsReadMutation.isPending,
        errorMarkingOne: markOneAsReadMutation.error,
        errorMarkingAll: markAllAsReadMutation.error,
    };
}