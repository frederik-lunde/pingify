// client/src/hooks/api/useAlerts.ts
import { useQuery, useMutation, useQueryClient, UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from "../../types"; // Ensure this path is correct
import {
    fetchUserAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    dismissAlert as dismissAlertAPI
} from '../../api/alertApi'; // Ensure this path is correct

// Consistent Query Keys
export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions = {}) => [...alertQueryKeys.lists(), 'user', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days?: number) => [...alertQueryKeys.all, 'stats', 'user', { days }] as const,
};

// Options for React Query hooks
interface UseAlertsHookOptions {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
    gcTime?: number; // Allow overriding garbage collection time
}

// Default cache times (consider making these configurable or context-based)
const DEFAULT_LIST_STALE_TIME = 1000 * 30; // 30 seconds
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 5; // 5 minutes
const DEFAULT_STATS_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const DEFAULT_STATS_GC_TIME = 1000 * 60 * 15; // 15 minutes

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
        enabled: hookOptions?.enabled, // Defaults to true if not provided
        refetchInterval: hookOptions?.refetchInterval, // Control polling
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        // Consider keeping previous data for smoother updates if lists change often
        // placeholderData: keepPreviousData, // TanStack Query v5+
        initialData: [], // Start with an empty array
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
    // Query is enabled only if websiteId is a valid number and hook is not explicitly disabled
    const isQueryEnabled = (hookOptions?.enabled ?? true) && typeof websiteId === 'number' && websiteId > 0;

    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        // Ensure fetch function is only called with a valid websiteId
        queryFn: () => {
            if (!websiteId) {
                // Should not happen if 'enabled' is set correctly, but safeguard
                console.warn("useWebsiteAlertsQuery called without valid websiteId");
                return Promise.resolve([]);
            }
            return fetchWebsiteAlerts(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        initialData: [], // Start with an empty array
    });
}

/**
 * Hook to fetch the authenticated user's alert statistics.
 */
export function useAlertStatsQuery(
    days = 7, // Default to 7 days
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
        // Provide a sensible initial data structure
        initialData: () => ({ totalAlerts: 0, byType: {}, byWebsite: [] }),
    });
}

// Define the return type for useAlertActions for clarity
interface UseAlertActionsReturn {
    dismissAlert: UseMutateFunction<void, ApiError, number, unknown>;
    dismissAlertAsync: UseMutateAsyncFunction<void, ApiError, number, unknown>;
    isDismissingAlert: boolean;
    errorDismissingAlert: ApiError | null;
}


/**
 * Hook providing mutation functions for alert actions (e.g., dismissing).
 */
export function useAlertActions(): UseAlertActionsReturn {
    const queryClient = useQueryClient();

    // Define the pattern for invalidating user-specific alert lists more broadly
    const userAlertListsQueryKeyPattern = alertQueryKeys.lists();
    // Also define the pattern for invalidating stats
    const userAlertStatsQueryKeyPattern = alertQueryKeys.stats();


    const dismissAlertMutation = useMutation<void, ApiError, number>({ // Alert ID is number
        mutationFn: dismissAlertAPI, // Pass the API function directly
         onSuccess: (data, alertId) => {
            // Optional: Log success
            console.log(`Alert ${alertId} dismissed successfully.`);
            // Invalidation is often preferred in onSettled, but can be here too
            // For faster UI feedback, optimistic updates are better (see below)
         },
         onError: (error, alertId) => {
            // Log error more visibly, e.g., using a toast notification library
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
            // Optionally show error to user
        },
        // onSettled runs after onSuccess or onError
        onSettled: (data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            // Invalidate queries to refetch data after the mutation attempt
            // This ensures the UI reflects the latest state from the server
            queryClient.invalidateQueries({ queryKey: userAlertListsQueryKeyPattern, refetchType: 'active' }); // Invalidate active user alert lists
            queryClient.invalidateQueries({ queryKey: userAlertStatsQueryKeyPattern, refetchType: 'active' }); // Invalidate active stats queries

            // Consider invalidating specific website alert lists if applicable and efficient
            // queryClient.invalidateQueries({ queryKey: alertQueryKeys.website(websiteIdFromAlert, {}) }); // Need websiteId
        },
        // OPTIONAL: Optimistic Updates (Advanced)
        // onMutate: async (alertIdToRemove) => {
        //   // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        //   await queryClient.cancelQueries({ queryKey: userAlertListsQueryKeyPattern });
        //
        //   // Snapshot the previous value
        //   const previousAlerts = queryClient.getQueryData<Alert[]>(userAlertListsQueryKeyPattern); // Use specific key if known
        //
        //   // Optimistically update to the new value
        //   if (previousAlerts) {
        //       queryClient.setQueryData<Alert[]>(userAlertListsQueryKeyPattern,
        //           old => (old ?? []).filter(alert => alert.id !== alertIdToRemove)
        //       );
        //   }
        //
        //   // Return a context object with the snapshotted value
        //   return { previousAlerts };
        // },
        // // If the mutation fails, use the context returned from onMutate to roll back
        // onError: (err, variables, context) => {
        //   if (context?.previousAlerts) {
        //     queryClient.setQueryData<Alert[]>(userAlertListsQueryKeyPattern, context.previousAlerts);
        //   }
        //   // ... handle error logging / display
        // },
    });

    return {
        dismissAlert: dismissAlertMutation.mutate,
        dismissAlertAsync: dismissAlertMutation.mutateAsync,
        isDismissingAlert: dismissAlertMutation.isPending, // Correctly maps to isPending
        errorDismissingAlert: dismissAlertMutation.error,
    };
}