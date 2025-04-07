// src/hooks/api/useWebsites.ts (Adjust path if needed)
import { useState, useCallback } from "react";
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryKey // Import QueryKey
} from '@tanstack/react-query';
import {
    // Import the actual API functions for user website management
    fetchUserWebsites,
    fetchUserWebsite,
    searchWebsites as apiSearchWebsites,
    createWebsite as apiAddWebsiteToUser,       // Renamed import for clarity
    updateWebsite as apiUpdateUserWebsite,     // Renamed import for clarity
    deleteWebsite as apiRemoveWebsiteFromUser, // Renamed import for clarity
} from '../../api/websitesApi'; // Adjust path if needed
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    Website,
    ApiError,
    // MonitoringResult // Not directly used here
} from "../../types"; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // <--- ADJUST PATH AS NEEDED

// --- Import Monitoring hooks/keys ---
import { monitoringQueryKeys, useWebsiteCheckMutation } from './useMonitoring'; // <--- ADJUST PATH AS NEEDED

// Query Keys (remain the same)
export const websiteQueryKeys = {
    all: ['websites'] as const,
    lists: (userId: number | undefined) => [...websiteQueryKeys.all, 'list', { userId }] as const,
    details: () => [...websiteQueryKeys.all, 'detail'] as const,
    detail: (id: number | undefined, userId: number | undefined) => [...websiteQueryKeys.details(), id, { userId }] as const,
    search: (query: string) => [...websiteQueryKeys.all, 'search', query] as const,
};

// Define a type for standard query options (remains the same)
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

// --- Query Hooks --- (remain the same)
export function useUserWebsitesQuery(options?: CustomQueryOptions<WebsiteUser[]>) {
    const { user } = useAuth();
    const userId = user?.id;
    return useQuery<WebsiteUser[], ApiError>({
        queryKey: websiteQueryKeys.lists(userId),
        queryFn: () => { if (!userId) return Promise.resolve([]); return fetchUserWebsites(); },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000 * 60 * 5, // Example: 5 min stale time for user list
        gcTime: 1000 * 60 * 15,
        ...options,
    });
}

export function useUserWebsiteQuery(websiteId: number | undefined, options?: CustomQueryOptions<WebsiteUser>) {
    const { user } = useAuth();
    const userId = user?.id;
    return useQuery<WebsiteUser, ApiError>({
        queryKey: websiteQueryKeys.detail(websiteId, userId),
        queryFn: () => { if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for query")); return fetchUserWebsite(websiteId); },
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        staleTime: 1000 * 60 * 1, // Example: 1 min stale time for detail
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
 * Invalidates relevant caches using partial keys and triggers initial check on creation.
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userId = user?.id;
    const { mutateAsync: triggerCheck, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Key Patterns for Invalidation ---
    const userWebsiteListKey: QueryKey = websiteQueryKeys.lists(userId);
    // Define PATTERNS using partial keys up to the user ID where applicable
    const userMonitoringResultsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
    const userOverallStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];


    // --- CREATE Mutation (Adds website TO USER) ---
    const addWebsiteMutation = useMutation<WebsiteUser, ApiError, AddWebsiteUserDTO>({
        mutationFn: (websiteData) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for adding website"));
             return apiAddWebsiteToUser(websiteData); // API handles mapping userId via token
        },
        onSuccess: async (newWebsiteUser) => {
            console.log('[Mutation Success] Website added for user:', newWebsiteUser);
            const websiteId = newWebsiteUser?.websiteId;

            // --- Invalidation using DEFINED Keys/Patterns ---
            if (!userId) return;

            console.log(`Invalidating caches for user ${userId} after add...`);
            // 1. Invalidate the user's website list
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            // 2. Invalidate user's monitoring results
            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            console.log(`Invalidating user monitoring results:`, userMonitoringResultsKeyPattern);

            // 3. Invalidate user's overall stats
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            console.log(`Invalidating overall user stats:`, userOverallStatsKeyPattern);

            console.log('Caches invalidated.');

            // --- Trigger Initial Check ---
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

    // --- UPDATE Mutation (Updates USER'S settings for a website) ---
    const updateSettingsMutation = useMutation<WebsiteUser | null, ApiError, { websiteId: number, websiteData: UpdateWebsiteUserDTO }>({
        mutationFn: (vars) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for updating website settings"));
             // API function expects { websiteId, websiteData }
             return apiUpdateUserWebsite(vars);
        },
        onSuccess: (updatedWebsiteUser, variables) => {
            console.log('[Mutation Success] User website settings updated:', updatedWebsiteUser);
            const websiteId = variables.websiteId;
            if (!userId || !updatedWebsiteUser) return;

            // --- Invalidation & Data Setting ---
            console.log(`Updating/Invalidating caches for user ${userId}, website ${websiteId} after update...`);

            // 1. Invalidate the user's website list
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            // 2. Set the data for the specific detail query
            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.setQueryData(detailKey, updatedWebsiteUser);
            console.log(`Setting website detail cache:`, detailKey);

            // 3. Invalidate website-specific monitoring stats if interval changed
            if (variables.websiteData.interval !== undefined) {
                // Define pattern for specific website stats FOR THIS USER
                const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
                queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern });
                console.log(`Invalidating website stats due to interval change:`, websiteStatsKeyPattern);

                // Invalidate overall user stats
                queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
                console.log(`Invalidating overall user stats due to interval change:`, userOverallStatsKeyPattern);
            }
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error updating website ${variables.websiteId}:`, error.message);
        },
    });

    // --- DELETE Mutation (Removes website FROM USER) ---
    const removeWebsiteMutation = useMutation<void, ApiError, number>({
        mutationFn: (websiteId: number) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for removing website"));
             // API function takes websiteId, userId is implicit via auth token
             return apiRemoveWebsiteFromUser(websiteId);
        },
        onSuccess: (_, websiteId) => {
            console.log(`[Mutation Success] Website ${websiteId} removed for user ${userId}.`);
            if (!userId) return;

            // --- Invalidation & Cache Removal using DEFINED Keys/Patterns ---
            console.log(`Invalidating/Removing caches for user ${userId}, website ${websiteId}...`);

            // 1. Invalidate the user's website list
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            console.log(`Invalidating user website list:`, userWebsiteListKey);

            // 2. Remove the specific detail query for this user/website
            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.removeQueries({ queryKey: detailKey });
            console.log(`Removing website detail query from cache:`, detailKey);

            // 3. Invalidate user's monitoring results and overall stats
            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            console.log(`Invalidating user monitoring results:`, userMonitoringResultsKeyPattern);
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            console.log(`Invalidating overall user stats:`, userOverallStatsKeyPattern);

            // 4. Remove specific monitoring stats/details for the deleted website for THIS USER
            const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: websiteStatsKeyPattern });
            console.log(`Removing website stats query from cache:`, websiteStatsKeyPattern);

            // Remove monitoring details queries specific to this user for this website
            // (Note: If details key didn't include userId, the pattern below would be simpler)
            const detailsKeyPatternForUser: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: detailsKeyPatternForUser, exact: false }); // Use exact: false to match subsets if params vary
            console.log(`Removing monitoring details query for user from cache:`, detailsKeyPatternForUser);


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
             // Calls the API function for updating user settings
             return apiUpdateUserWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } });
        },
         onSuccess: (updatedWebsiteUser, variables) => {
             if (!userId || !updatedWebsiteUser) return;
             const websiteId = variables.websiteId;
             console.log(`[Mutation Success] Website ${websiteId} alert status toggled:`, updatedWebsiteUser.alertEnabled);

             // Invalidate list and set specific detail data
             queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
             const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
             queryClient.setQueryData(detailKey, updatedWebsiteUser);
             console.log(`Setting website detail cache after toggle:`, detailKey);
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
        // Expose loading/error states
        isAdding: addWebsiteMutation.isPending,
        isUpdating: updateSettingsMutation.isPending,
        isRemoving: removeWebsiteMutation.isPending,
        isTogglingAlert: toggleAlertEnabledMutation.isPending,
        isTriggeringCheck: isChecking, // Loading state from the check mutation
        errorAdding: addWebsiteMutation.error,
        errorUpdating: updateSettingsMutation.error,
        errorRemoving: removeWebsiteMutation.error,
        errorToggling: toggleAlertEnabledMutation.error,
    };
}