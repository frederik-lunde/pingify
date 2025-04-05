//client\src\hooks\api\useWebsites.ts
import { useState, useCallback } from "react";
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions // <-- Import UseQueryOptions
} from '@tanstack/react-query';
import {
    fetchUserWebsites,
    fetchUserWebsite,
    searchWebsites as apiSearchWebsites, // Renamed import
    createWebsite,
    updateWebsite,
    deleteWebsite,
} from '../../api/websitesApi'; // Adjust path
import {
    WebsiteUser,        
    AddWebsiteUserDTO,  
    UpdateWebsiteUserDTO,
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

// Define a type for standard query options, omitting keys set internally
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn' // Omit keys that are defined within the hook
>;

/**
 * Hook for fetching the user's list of websites.
 */
export function useUserWebsitesQuery(options?: CustomQueryOptions<WebsiteUser[]>) {
    return useQuery<WebsiteUser[], ApiError>({
        queryKey: websiteQueryKeys.lists(),
        queryFn: fetchUserWebsites,
        // NO initialData should be passed or set here by default
        ...options,
    });
}

/**
 * Hook for fetching a single user website by ID.
 */
export function useUserWebsiteQuery(websiteId: number | undefined, options?: CustomQueryOptions<WebsiteUser>) {
    return useQuery<WebsiteUser, ApiError>({
        queryKey: websiteQueryKeys.detail(websiteId),
        queryFn: () => fetchUserWebsite(websiteId!),
        enabled: options?.enabled ?? (!!websiteId && websiteId > 0),
        // NO initialData here either unless explicitly needed and handled
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
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();

    // CREATE Mutation
    const createMutation = useMutation<WebsiteUser, ApiError, AddWebsiteUserDTO>({
        mutationFn: createWebsite,
        onSuccess: (newWebsite) => {
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            console.log('Website created:', newWebsite);
        },
        onError: (error) => {
            console.error("Error creating website:", error.message);
        },
    });

    // UPDATE Mutation
    const updateMutation = useMutation<WebsiteUser, ApiError, { websiteId: number, websiteData: UpdateWebsiteUserDTO }>({
        mutationFn: updateWebsite,
        onSuccess: (updatedWebsite, variables) => {
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.detail(variables.websiteId) });
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
            queryClient.invalidateQueries({ queryKey: websiteQueryKeys.lists() });
            queryClient.removeQueries({ queryKey: websiteQueryKeys.detail(websiteId) });
            console.log(`Website deleted: ${websiteId}`);
        },
        onError: (error, websiteId) => {
            console.error(`Error deleting website ${websiteId}:`, error.message);
        },
    });

     // Utility mutation for toggling alerts (uses the update mutation)
     const toggleAlertEnabledMutation = useMutation<WebsiteUser, ApiError, { websiteId: number, currentStatus: boolean }>({
        mutationFn: ({ websiteId, currentStatus }) => updateWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } }),
         onSuccess: (updatedWebsite, variables) => {
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
        errorCreating: createMutation.error,
        errorUpdating: updateMutation.error,
        errorDeleting: deleteMutation.error,
        errorToggling: toggleAlertEnabledMutation.error,
    };
}