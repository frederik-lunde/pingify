/*
client/src/hooks/api/useWebsites.ts
*/
import { useState, useCallback } from "react";
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey
} from '@tanstack/react-query';
import {
    fetchUserWebsites,
    fetchUserWebsite,
    searchWebsites as apiSearchWebsites,
    createWebsite as apiAddWebsiteToUser,
    updateWebsite as apiUpdateUserWebsite,
    deleteWebsite as apiRemoveWebsiteFromUser,
    setWebsitePinStatus as apiSetPinStatus,
} from '../../api/websitesApi'; // Adjust path if needed
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    SetPinStatusDTO,
    Website,
    ApiError,
} from "../../types"; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // <--- ADJUST PATH AS NEEDED
import { monitoringQueryKeys, useWebsiteCheckMutation } from './useMonitoring'; // <--- ADJUST PATH AS NEEDED
// --- Import alert keys (assuming alertQueryKeys is defined elsewhere or imported correctly) ---
import { alertQueryKeys } from './useAlerts'; // Example path, adjust if needed

// Query Keys
export const websiteQueryKeys = {
    all: ['websites'] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    lists: (userId: string | undefined) => [...websiteQueryKeys.all, 'list', { userId }] as const,
    details: () => [...websiteQueryKeys.all, 'detail'] as const,
    // --- MODIFIED: userId type changed to string | undefined ---
    detail: (id: number | undefined, userId: string | undefined) => [...websiteQueryKeys.details(), id, { userId }] as const,
    search: (query: string) => [...websiteQueryKeys.all, 'search', query] as const,
};

// Define a type for standard query options
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

// --- Query Hooks ---
export function useUserWebsitesQuery(options?: CustomQueryOptions<WebsiteUser[]>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    return useQuery<WebsiteUser[], ApiError>({
        // --- Now correctly passes string | undefined ---
        queryKey: websiteQueryKeys.lists(userId),
        queryFn: () => { if (!userId) return Promise.resolve([]); return fetchUserWebsites(); },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000,
        gcTime: 1000 * 60 * 15,
        ...options,
    });
}

export function useUserWebsiteQuery(websiteId: number | undefined, options?: CustomQueryOptions<WebsiteUser>) {
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    return useQuery<WebsiteUser, ApiError>({
        // --- Now correctly passes string | undefined ---
        queryKey: websiteQueryKeys.detail(websiteId, userId),
        queryFn: () => { if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for query")); return fetchUserWebsite(websiteId); },
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        staleTime: 1000,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}

export function useWebsiteSearch(limit: number = 10) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Website[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);
    const search = useCallback(async (searchQuery: string) => { setQuery(searchQuery); if (!searchQuery.trim()) { setResults([]); return []; } setLoading(true); setError(null); try { const data = await apiSearchWebsites(searchQuery, limit); setResults(data); return data; } catch (err) { setError(err as ApiError); console.error("Error searching websites:", err); setResults([]); return []; } finally { setLoading(false); } }, [limit]);
    return { query, results, loading, error, search };
 }

/**
 * Hook for website CRUD mutations related to the current user.
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id; // This is string | undefined
    const { mutateAsync: triggerCheck, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Key Patterns for Invalidation (these key generators now accept string | undefined) ---
    const userWebsiteListKey: QueryKey = websiteQueryKeys.lists(userId);
    const userMonitoringResultsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
    const userOverallStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];
    const userAlertListKeyPattern: QueryKey = alertQueryKeys.lists(); // Assuming this doesn't need userId or accepts string
    const userAlertStatsKeyPattern: QueryKey = alertQueryKeys.stats(); // Assuming this doesn't need userId or accepts string

    // --- CREATE Mutation ---
    const addWebsiteMutation = useMutation<WebsiteUser, ApiError, AddWebsiteUserDTO>({
        mutationFn: (websiteData) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for adding website"));
             return apiAddWebsiteToUser({ ...websiteData, isPinned: websiteData.isPinned ?? false });
        },
        onSuccess: async (newWebsiteUser) => {
            console.log('[Mutation Success] Website added for user:', newWebsiteUser);
            const websiteId = newWebsiteUser?.websiteId;
            if (!userId) return;
            console.log(`Invalidating caches for user ${userId} after add...`);

            // Invalidation uses the updated key generators implicitly
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);
            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            console.log(`Invalidating user monitoring results:`, userMonitoringResultsKeyPattern);
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            console.log(`Invalidating overall user stats:`, userOverallStatsKeyPattern);
            queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
            console.log(`Invalidating alerts`);
            console.log('Caches invalidated.');

            if (websiteId) {
                try {
                    console.log(`Triggering initial check for new website ${websiteId}...`);
                    await triggerCheck(websiteId);
                    console.log(`Initial check triggered for website ${websiteId}.`);
                } catch (checkError) {
                    console.error(`Failed to trigger initial check for website ${websiteId}:`, checkError);
                }
            } else {
                 console.warn("Could not trigger initial check: Website ID not found after addWebsite operation.");
            }
        },
        onError: (error) => {
            console.error("[Mutation Error] Error adding website:", error.message);
        },
    });

    // --- UPDATE Mutation ---
    const updateSettingsMutation = useMutation<WebsiteUser | null, ApiError, { websiteId: number, websiteData: UpdateWebsiteUserDTO }>({
        mutationFn: (vars) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for updating website settings"));
             return apiUpdateUserWebsite(vars);
        },
        onSuccess: (updatedWebsiteUser, variables) => {
            console.log('[Mutation Success] User website settings updated:', updatedWebsiteUser);
            const websiteId = variables.websiteId;
            if (!userId || !updatedWebsiteUser) return;
            console.log(`Updating/Invalidating caches for user ${userId}, website ${websiteId} after update...`);

            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.setQueryData(detailKey, updatedWebsiteUser);
            console.log(`Setting website detail cache:`, detailKey);

            if (variables.websiteData.interval !== undefined) {
                const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
                queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern });
                console.log(`Invalidating website stats due to interval change:`, websiteStatsKeyPattern);
                queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
                console.log(`Invalidating overall user stats due to interval change:`, userOverallStatsKeyPattern);
            }
            if (variables.websiteData.alertEnabled !== undefined || variables.websiteData.alertThreshold !== undefined) {
                 queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
                 queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
                 console.log(`Invalidating alerts due to settings change`);
            }
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error updating website ${variables.websiteId}:`, error.message);
        },
    });

    // --- SET PIN STATUS Mutation ---
    const setPinStatusMutation = useMutation<WebsiteUser, ApiError, { websiteId: number; isPinned: boolean }>({
        mutationFn: ({ websiteId, isPinned }) => {
            if (!userId) return Promise.reject(new Error("User not authenticated for setting pin status"));
            const pinData: SetPinStatusDTO = { isPinned };
            return apiSetPinStatus({ websiteId, pinData });
        },
        onSuccess: (updatedWebsiteUser, variables) => {
            const { websiteId, isPinned } = variables;
            console.log(`[Mutation Success] Pin status set to ${isPinned} for website ${websiteId}.`, updatedWebsiteUser);
            if (!userId || !updatedWebsiteUser) return;
            console.log(`Updating/Invalidating caches for user ${userId}, website ${websiteId} after pin update...`);

            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.setQueryData(detailKey, updatedWebsiteUser);
            console.log(`Setting website detail cache after pin update:`, detailKey);
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error setting pin status for website ${variables.websiteId}:`, error.message);
        },
    });

    // --- DELETE Mutation ---
    const removeWebsiteMutation = useMutation<void, ApiError, number>({
        mutationFn: (websiteId: number) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for removing website"));
             return apiRemoveWebsiteFromUser(websiteId);
        },
        onSuccess: (_, websiteId) => {
            console.log(`[Mutation Success] Website ${websiteId} removal initiated for user ${userId}.`);
            if (!userId) return;
            console.log(`Invalidating/Removing caches for user ${userId}, website ${websiteId}...`);

            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.removeQueries({ queryKey: detailKey });
            console.log(`Removing website detail query from cache:`, detailKey);

            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            console.log(`Invalidating user monitoring results:`, userMonitoringResultsKeyPattern);
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            console.log(`Invalidating overall user stats:`, userOverallStatsKeyPattern);

            const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: websiteStatsKeyPattern });
            console.log(`Removing website stats query from cache:`, websiteStatsKeyPattern);

            const detailsKeyPatternForUser: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: detailsKeyPatternForUser, exact: false });
            console.log(`Removing monitoring details query for user from cache:`, detailsKeyPatternForUser);

            queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
            console.log(`Invalidating alerts and incident count after removal`);

            console.log(`Website ${websiteId} deletion cleanup complete.`);
        },
        onError: (error, websiteId) => {
            console.error(`[Mutation Error] Error removing website ${websiteId}:`, error.message);
        },
    });

     // --- Utility mutation for toggling alerts ---
     const toggleAlertEnabledMutation = useMutation<WebsiteUser | null, ApiError, { websiteId: number, currentStatus: boolean }>({
        mutationFn: ({ websiteId, currentStatus }) => {
             if (!userId) return Promise.reject(new Error("User not authenticated"));
             return apiUpdateUserWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } });
        },
         onSuccess: (updatedWebsiteUser, variables) => {
             if (!userId || !updatedWebsiteUser) return;
             const websiteId = variables.websiteId;
             console.log(`[Mutation Success] Website ${websiteId} alert status toggled:`, updatedWebsiteUser.alertEnabled);

             queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
             const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
             queryClient.setQueryData(detailKey, updatedWebsiteUser);
             console.log(`Setting website detail cache after toggle:`, detailKey);

             queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
             queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
             console.log(`Invalidating alerts after toggle`);
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error toggling alert status for website ${variables.websiteId}:`, error.message);
        },
     });

    // --- Return Hook Values ---
    return {
        addWebsite: addWebsiteMutation.mutateAsync,
        updateSettings: updateSettingsMutation.mutateAsync,
        removeWebsite: removeWebsiteMutation.mutateAsync,
        toggleAlertEnabled: toggleAlertEnabledMutation.mutateAsync,
        setPinStatus: setPinStatusMutation.mutateAsync,
        isAdding: addWebsiteMutation.isPending,
        isUpdating: updateSettingsMutation.isPending,
        isRemoving: removeWebsiteMutation.isPending,
        isTogglingAlert: toggleAlertEnabledMutation.isPending,
        isSettingPin: setPinStatusMutation.isPending,
        isTriggeringCheck: isChecking,
        errorAdding: addWebsiteMutation.error,
        errorUpdating: updateSettingsMutation.error,
        errorRemoving: removeWebsiteMutation.error,
        errorToggling: toggleAlertEnabledMutation.error,
        errorSettingPin: setPinStatusMutation.error,
    };
}