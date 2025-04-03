// src/hooks/api/useWebsites.ts
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchUserWebsites,
    fetchUserWebsite,
    searchWebsites as apiSearchWebsites, // Renamed import
    createWebsite,
    updateWebsite,
    deleteWebsite,
} from '../../api/websitesApi'; // Adjust path
import {
    UserWebsite,
    WebsiteCreateDTO,
    WebsiteUpdateDTO,
    Website,
    ApiError,
} from "../../types"; // Adjust path

// Query Keys
export const websiteQueryKeys = {
    all: ['websites'] as const,
    lists: () => [...websiteQueryKeys.all, 'list'] as const, // For user's dashboard list
    details: () => [...websiteQueryKeys.all, 'detail'] as const,
    detail: (id: number | undefined) => [...websiteQueryKeys.details(), id] as const, // For single website detail
    search: (query: string) => [...websiteQueryKeys.all, 'search', query] as const, // For search results (if using useQuery for search)
};

/**
 * Hook for fetching the user's list of websites.
 */
export function useUserWebsitesQuery(options?: { enabled?: boolean, refetchInterval?: number | false }) {
    return useQuery<UserWebsite[], ApiError>({
        queryKey: websiteQueryKeys.lists(),
        queryFn: fetchUserWebsites,
        enabled: options?.enabled,
        refetchInterval: options?.refetchInterval,
        // staleTime: 1000 * 60 * 2, // List might not change frequently (2 min)
    });
}

/**
 * Hook for fetching a single user website by ID.
 */
export function useUserWebsiteQuery(websiteId: number | undefined, options?: { enabled?: boolean }) {
    return useQuery<UserWebsite, ApiError>({
        queryKey: websiteQueryKeys.detail(websiteId),
        queryFn: () => fetchUserWebsite(websiteId!), // Assert non-null handled by enabled
        enabled: options?.enabled ?? (!!websiteId && websiteId > 0), // Enable only if websiteId is valid
    });
}

/**
 * Hook for searching websites (manual trigger).
 * Uses local state for simplicity as it's not automatically refetched/cached like useQuery.
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
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();

    // CREATE Mutation
    const createMutation = useMutation<UserWebsite, ApiError, WebsiteCreateDTO>({
        mutationFn: createWebsite,
        onSuccess: (newWebsite) => {
            // Invalidate list to refetch
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            // Optionally pre-populate cache
            // queryClient.setQueryData<UserWebsite[]>(websiteQueryKeys.lists(), (old) => [...(old ?? []), newWebsite]);
            console.log('Website created:', newWebsite);
        },
        onError: (error) => {
            console.error("Error creating website:", error.message);
        },
    });

    // UPDATE Mutation
    const updateMutation = useMutation<UserWebsite, ApiError, { websiteId: number, websiteData: WebsiteUpdateDTO }>({
        mutationFn: updateWebsite,
        onSuccess: (updatedWebsite, variables) => {
            // Invalidate list and specific detail queries
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.detail(variables.websiteId) });
            // Optionally update caches directly
            // queryClient.setQueryData<UserWebsite[]>(websiteQueryKeys.lists(), (old) => old?.map(w => w.websiteId === variables.websiteId ? updatedWebsite : w));
            // queryClient.setQueryData<UserWebsite>(websiteQueryKeys.detail(variables.websiteId), updatedWebsite);
            console.log('Website updated:', updatedWebsite);
        },
        onError: (error, variables) => {
            console.error(`Error updating website ${variables.websiteId}:`, error.message);
        },
    });

    // DELETE Mutation
    const deleteMutation = useMutation<void, ApiError, number>({ // Variable is websiteId (number)
        mutationFn: deleteWebsite,
        onSuccess: (_, websiteId) => {
            // Invalidate list
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            // Remove the specific detail query from cache
            queryClient.removeQueries({ queryKey: websiteQueryKeys.detail(websiteId) });
            // Optionally update list cache directly
            // queryClient.setQueryData<UserWebsite[]>(websiteQueryKeys.lists(), (old) => old?.filter(w => w.websiteId !== websiteId));
            console.log(`Website deleted: ${websiteId}`);
        },
        onError: (error, websiteId) => {
            console.error(`Error deleting website ${websiteId}:`, error.message);
        },
    });

     // Utility mutation for toggling alerts (uses the update mutation)
     const toggleAlertEnabledMutation = useMutation<UserWebsite, ApiError, { websiteId: number, currentStatus: boolean }>({
        mutationFn: ({ websiteId, currentStatus }) => updateWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } }),
         onSuccess: (updatedWebsite, variables) => {
            // Invalidate list and specific detail queries like regular update
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.detail(variables.websiteId) });
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
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isTogglingAlert: toggleAlertEnabledMutation.isPending,
        // Consolidate errors if needed, or let components access individual errors
        errorCreating: createMutation.error,
        errorUpdating: updateMutation.error,
        errorDeleting: deleteMutation.error,
        errorToggling: toggleAlertEnabledMutation.error,
    };
}