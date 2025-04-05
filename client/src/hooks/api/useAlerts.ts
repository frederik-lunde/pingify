import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertStats, AlertQueryOptions, AlertUser, ApiError } from "../../types"; // Adjust path if needed
// Import API functions
import {
    fetchUserAlerts,
    fetchUserUnreadAlerts,
    fetchWebsiteAlerts,
    fetchAlertStats,
    markAlertAsRead as markAlertAsReadAPI,
    markAllAlertsAsRead as markAllAlertsAsReadAPI,
    deleteAlertForUser as deleteAlertForUserAPI
} from '../../api/alertApi'; // Adjust path if needed

// --- Query Keys ---
export const alertQueryKeys = {
    all: ['alerts'] as const,
    lists: () => [...alertQueryKeys.all, 'list'] as const,
    list: (options: AlertQueryOptions = {}) => [...alertQueryKeys.lists(), options] as const,
    userUnread: (options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'user', 'unread', options] as const,
    website: (websiteId: number | undefined, options: AlertQueryOptions = {}) => [...alertQueryKeys.all, 'website', websiteId, options] as const,
    stats: (days?: number) => [...alertQueryKeys.all, 'stats', { days }] as const,
};

// --- Query Hook Options ---
interface AlertQueryHookOptions {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
}


// --- Query Hooks ---

export function useUserAlertsQuery(
    options: AlertQueryOptions = {},
    queryOptions?: AlertQueryHookOptions
) {
    const queryKey = alertQueryKeys.list(options);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserAlerts(options),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
        staleTime: queryOptions?.staleTime ?? 1000 * 60,
        initialData: [],
    });
}

export function useUserUnreadAlertsQuery(
    options: AlertQueryOptions = {},
    queryOptions?: AlertQueryHookOptions
) {
    const queryFnOptions = { isResolved: false, ...options };
    const queryKey = alertQueryKeys.userUnread(queryFnOptions);

    return useQuery<AlertUser[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchUserUnreadAlerts(queryFnOptions),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
        staleTime: queryOptions?.staleTime ?? 1000 * 30,
        initialData: [],
    });
}

export function useWebsiteAlertsQuery(
    websiteId: number | undefined,
    options: AlertQueryOptions = {},
    queryOptions?: AlertQueryHookOptions
) {
    const queryKey = alertQueryKeys.website(websiteId, options);
    return useQuery<Alert[], ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchWebsiteAlerts(websiteId!, options),
        enabled: (queryOptions?.enabled ?? true) && typeof websiteId === 'number' && websiteId > 0,
        refetchInterval: queryOptions?.refetchInterval,
        staleTime: queryOptions?.staleTime ?? 1000 * 60 * 5,
        initialData: [],
    });
}

export function useAlertStatsQuery(
    days = 7,
    queryOptions?: AlertQueryHookOptions
) {
    const queryKey = alertQueryKeys.stats(days);
    return useQuery<AlertStats, ApiError>({
        queryKey: queryKey,
        queryFn: () => fetchAlertStats(days),
        enabled: queryOptions?.enabled,
        refetchInterval: queryOptions?.refetchInterval,
        staleTime: queryOptions?.staleTime ?? 1000 * 60 * 15,
        initialData: () => ({
            totalAlerts: 0, resolvedAlerts: 0, unresolvedAlerts: 0, byType: {}, byWebsite: []
        }),
    });
}


// --- Mutation Hooks ---

/**
 * Defines the expected shape of the context object returned by onMutate.
 */
interface AlertMutationContext {
    previousUnreadAlerts?: AlertUser[]; // Make it optional as onMutate might fail before returning
}


export function useAlertActions() {
    const queryClient = useQueryClient();

    const unreadListBaseQueryKey = alertQueryKeys.userUnread({ isResolved: false });
    const generalListBaseQueryKey = alertQueryKeys.list({});

    // --- Mutation: Mark ONE alert as read ---
    const markOneAsReadMutation = useMutation<void, ApiError, number, AlertMutationContext>({ // Add context type
        mutationFn: markAlertAsReadAPI,
        onMutate: async (alertId): Promise<AlertMutationContext> => { // Ensure return type matches context
            await queryClient.cancelQueries({ queryKey: unreadListBaseQueryKey });
            const previousUnreadAlerts = queryClient.getQueryData<AlertUser[]>(unreadListBaseQueryKey);
            queryClient.setQueryData<AlertUser[]>(
                unreadListBaseQueryKey,
                (oldData = []) => oldData.filter(alertUser => alertUser.alertId !== alertId)
            );
            // Return the context object *successfully*
            return { previousUnreadAlerts };
        },
        onError: (error, alertId, context) => {
            console.error(`Failed to mark alert ${alertId} as read:`, error.message);
            // FIX: Check if context and the property exist before using it
            if (context?.previousUnreadAlerts) {
                queryClient.setQueryData(unreadListBaseQueryKey, context.previousUnreadAlerts);
            } else {
                // If context is missing, invalidate to be safe (refetch from server)
                queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            }
        },
        onSettled: (data, error, alertId) => {
            console.log(`MarkAsRead mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            queryClient.invalidateQueries({ queryKey: generalListBaseQueryKey });
        },
    });

    // --- Mutation: Mark ALL alerts as read ---
    const markAllAsReadMutation = useMutation<void, ApiError, void, AlertMutationContext>({ // Add context type
        mutationFn: markAllAlertsAsReadAPI,
        onMutate: async (): Promise<AlertMutationContext> => { // Ensure return type matches context
            await queryClient.cancelQueries({ queryKey: unreadListBaseQueryKey });
            const previousUnreadAlerts = queryClient.getQueryData<AlertUser[]>(unreadListBaseQueryKey);
            queryClient.setQueryData<AlertUser[]>(unreadListBaseQueryKey, () => []);
            return { previousUnreadAlerts };
        },
        onError: (error, _variables, context) => {
            console.error("Failed to mark all alerts as read:", error.message);
             // FIX: Check if context and the property exist before using it
            if (context?.previousUnreadAlerts) {
                queryClient.setQueryData(unreadListBaseQueryKey, context.previousUnreadAlerts);
            } else {
                queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            }
        },
        onSettled: (data, error) => {
             console.log(`MarkAllAsRead mutation settled. Error: ${error?.message ?? 'None'}`);
            queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            queryClient.invalidateQueries({ queryKey: generalListBaseQueryKey });
        },
    });

    // --- Mutation: Dismiss (delete AlertUser link) ONE alert for the user ---
    const dismissAlertMutation = useMutation<void, ApiError, number, AlertMutationContext>({ // Add context type
        mutationFn: deleteAlertForUserAPI,
        onMutate: async (alertId): Promise<AlertMutationContext> => { // Ensure return type matches context
            await queryClient.cancelQueries({ queryKey: unreadListBaseQueryKey });
            const previousUnreadAlerts = queryClient.getQueryData<AlertUser[]>(unreadListBaseQueryKey);
            queryClient.setQueryData<AlertUser[]>(
                unreadListBaseQueryKey,
                (oldData = []) => oldData.filter(alertUser => alertUser.alertId !== alertId)
            );
            return { previousUnreadAlerts };
        },
         onError: (error, alertId, context) => {
            console.error(`Failed to dismiss alert ${alertId}:`, error.message);
            // FIX: Check if context and the property exist before using it
            if (context?.previousUnreadAlerts) {
                queryClient.setQueryData(unreadListBaseQueryKey, context.previousUnreadAlerts);
            } else {
                 queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            }
        },
        onSettled: (data, error, alertId) => {
            console.log(`DismissAlert mutation settled for alert ${alertId}. Error: ${error?.message ?? 'None'}`);
            queryClient.invalidateQueries({ queryKey: unreadListBaseQueryKey });
            queryClient.invalidateQueries({ queryKey: generalListBaseQueryKey });
        },
    });


    // --- Return Value ---
    return {
        markAsRead: markOneAsReadMutation.mutate,
        markAsReadAsync: markOneAsReadMutation.mutateAsync,
        isMarkingAsRead: markOneAsReadMutation.isPending,
        errorMarkingAsRead: markOneAsReadMutation.error,

        markAllAsRead: markAllAsReadMutation.mutate,
        markAllAsReadAsync: markAllAsReadMutation.mutateAsync,
        isMarkingAllAsRead: markAllAsReadMutation.isPending,
        errorMarkingAllAsRead: markAllAsReadMutation.error,

        dismissAlert: dismissAlertMutation.mutate,
        dismissAlertAsync: dismissAlertMutation.mutateAsync,
        isDismissingAlert: dismissAlertMutation.isPending,
        errorDismissingAlert: dismissAlertMutation.error,
    };
}