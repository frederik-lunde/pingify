import { useState, useCallback } from "react";
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions
} from '@tanstack/react-query';
import {
    fetchUserWebsites,
    fetchUserWebsite,
    searchWebsites as apiSearchWebsites,
    createWebsite,
    updateWebsite,
    deleteWebsite,
} from '../../api/websitesApi'; // Adjust path if needed
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    Website,
    ApiError,
    MonitoringResult // Import MonitoringResult if needed for types, though not directly used here
} from "../../types"; // Adjust path if needed
import { useAuth } from '../../context/AuthContext'; // <--- ADJUST PATH AS NEEDED

// --- Import Monitoring hooks/keys ---
import { monitoringQueryKeys, useWebsiteCheckMutation } from './useMonitoring'; // <--- ADJUST PATH AS NEEDED

// Query Keys
export const websiteQueryKeys = {
    all: ['websites'] as const,
    lists: (userId: number | undefined) => [...websiteQueryKeys.all, 'list', { userId }] as const,
    details: () => [...websiteQueryKeys.all, 'detail'] as const,
    detail: (id: number | undefined, userId: number | undefined) => [...websiteQueryKeys.details(), id, { userId }] as const,
    search: (query: string) => [...websiteQueryKeys.all, 'search', query] as const,
};

// Define a type for standard query options
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Hook for fetching the user's list of websites.
 */
export function useUserWebsitesQuery(options?: CustomQueryOptions<WebsiteUser[]>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<WebsiteUser[], ApiError>({
        queryKey: websiteQueryKeys.lists(userId),
        queryFn: () => {
            if (!userId) return Promise.resolve([]);
            return fetchUserWebsites();
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 0, // <--- SET STALE TIME TO 0
        ...options,
    });
}

/**
 * Hook for fetching a single user website by ID.
 */
export function useUserWebsiteQuery(websiteId: number | undefined, options?: CustomQueryOptions<WebsiteUser>) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<WebsiteUser, ApiError>({
        queryKey: websiteQueryKeys.detail(websiteId, userId),
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchUserWebsite(websiteId);
        },
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        ...options,
    });
}

/**
 * Hook for searching websites (manual trigger).
 */
export function useWebsiteSearch(limit: number = 10) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Website[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);

    const search = useCallback(async (searchQuery: string) => {
        setQuery(searchQuery);
        if (!searchQuery.trim()) {
            setResults([]);
            return [];
        }
        setLoading(true);
        setError(null);
        try {
            const data = await apiSearchWebsites(searchQuery, limit);
            setResults(data);
            return data;
        } catch (err) {
            setError(err as ApiError);
            console.error("Error searching websites:", err);
            setResults([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [limit]);

    return { query, results, loading, error, search };
}

/**
 * Hook for website CRUD mutations.
 * Invalidates relevant caches and triggers initial check on creation.
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Get user for invalidations
    const userId = user?.id;
    // Get the check mutation function
    const { mutateAsync: triggerCheck, isPending: isChecking } = useWebsiteCheckMutation(); // Get mutateAsync and loading state

    // CREATE Mutation
    const createMutation = useMutation<WebsiteUser, ApiError, AddWebsiteUserDTO>({
        mutationFn: createWebsite,
        // Make onSuccess async to await the triggerCheck
        onSuccess: async (newWebsite) => {
            console.log('Website created:', newWebsite);
            const newWebsiteId = newWebsite?.websiteId; // Safely access ID

            // --- Invalidation ---
            console.log(`Invalidating caches for user ${userId}...`);
            // 1. Invalidate the user's website list
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists(userId) });

            // 2. Invalidate the user's overall monitoring results (to include the new site eventually)
            // Use slice(0, 3) to target ['monitoring', 'userResults', { userId }]
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId).slice(0, 3) });

            // 3. Invalidate the user's overall stats (total websites changed)
            // Use slice(0, 4) to target ['monitoring', 'stats', 'user', { userId }]
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userStats(undefined, userId).slice(0, 4) });

            console.log('Caches invalidated.');

            // --- Trigger Initial Check (Recommended) ---
            if (newWebsiteId && userId) { // Ensure we have IDs
                try {
                    console.log(`Triggering initial check for new website ${newWebsiteId}...`);
                    // Call the mutation function from useWebsiteCheckMutation
                    await triggerCheck(newWebsiteId);
                    console.log(`Initial check triggered for website ${newWebsiteId}.`);
                    // Optional: Could invalidate results again after a short delay, but refetchOnWindowFocus might handle it.
                    // setTimeout(() => {
                    //    queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId).slice(0, 3) });
                    // }, 2000); // e.g., wait 2 seconds
                } catch (checkError) {
                    console.error(`Failed to trigger initial check for website ${newWebsiteId}:`, checkError);
                    // Handle error (e.g., show notification to user)
                }
            } else {
                 console.warn("Could not trigger initial check: New website ID or User ID not found.");
            }
        },
        onError: (error) => {
            console.error("Error creating website:", error.message);
            // Handle error (e.g., show notification to user)
        },
    });

    // UPDATE Mutation
    const updateMutation = useMutation<WebsiteUser, ApiError, { websiteId: number, websiteData: UpdateWebsiteUserDTO }>({
        mutationFn: updateWebsite,
        onSuccess: (updatedWebsite, variables) => {
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists(userId) });
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.detail(variables.websiteId, userId) });
            // Consider invalidating monitoring details/stats if relevant fields changed
            // queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.details({ websiteId: variables.websiteId }, userId) });
            // queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.websiteStats(variables.websiteId, undefined, userId).slice(0, 4) });
            console.log('Website updated:', updatedWebsite);
        },
        onError: (error, variables) => {
            console.error(`Error updating website ${variables.websiteId}:`, error.message);
        },
    });

    // DELETE Mutation
    const deleteMutation = useMutation<void, ApiError, number>({
        mutationFn: deleteWebsite,
        onSuccess: (_, websiteId) => {
            console.log(`Deleting website ${websiteId} for user ${userId}...`);
            // Invalidate the specific user's list
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists(userId) });

            // Remove the specific user's detail query for this website from cache
            queryClient.removeQueries({ queryKey: websiteQueryKeys.detail(websiteId, userId) });

            // Also invalidate monitoring results and stats as the website is gone
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId).slice(0, 3) });
            queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userStats(undefined, userId).slice(0, 4) });

            // Remove specific stats/details for the deleted website for this user
            queryClient.removeQueries({ queryKey: ['monitoring', 'stats', 'website', websiteId, { userId }] });
            queryClient.removeQueries({ queryKey: ['monitoring', 'details', websiteId, { userId }] });

            console.log(`Website ${websiteId} deleted and associated caches invalidated/removed.`);
        },
        onError: (error, websiteId) => {
            console.error(`Error deleting website ${websiteId}:`, error.message);
        },
    });

     // Utility mutation for toggling alerts
     const toggleAlertEnabledMutation = useMutation<WebsiteUser, ApiError, { websiteId: number, currentStatus: boolean }>({
        mutationFn: ({ websiteId, currentStatus }) => updateWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } }),
         onSuccess: (updatedWebsite, variables) => {
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists(userId) });
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.detail(variables.websiteId, userId) });
             console.log('Website alert status toggled:', updatedWebsite);
        },
        onError: (error, variables) => {
            console.error(`Error toggling alert status for website ${variables.websiteId}:`, error.message);
        },
     });

    return {
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: deleteMutation.mutateAsync,
        toggleAlertEnabled: toggleAlertEnabledMutation.mutateAsync,
        // Expose loading/error states including the check trigger
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isTogglingAlert: toggleAlertEnabledMutation.isPending,
        isTriggeringCheck: isChecking, // Add loading state for the check
        errorCreating: createMutation.error,
        errorUpdating: updateMutation.error,
        errorDeleting: deleteMutation.error,
        errorToggling: toggleAlertEnabledMutation.error,
    };
}