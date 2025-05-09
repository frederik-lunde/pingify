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
} from '../../api/websitesApi';
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    SetPinStatusDTO,
    Website,
    ApiError,
} from "../../types";
import { useAuth } from '../../context/AuthContext';
import { monitoringQueryKeys, useWebsiteCheckMutation } from './useMonitoring';
import { alertQueryKeys } from './useAlerts';

/**
 * Defines query keys for website-related data.
 */
export const websiteQueryKeys = {
    all: ['websites'] as const,
    lists: (userId: string | undefined) => [...websiteQueryKeys.all, 'list', { userId }] as const,
    details: () => [...websiteQueryKeys.all, 'detail'] as const,
    detail: (id: number | undefined, userId: string | undefined) => [...websiteQueryKeys.details(), id, { userId }] as const,
    search: (query: string) => [...websiteQueryKeys.all, 'search', query] as const,
};

type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Custom hook to fetch all websites associated with the current user.
 */
export function useUserWebsitesQuery(options?: CustomQueryOptions<WebsiteUser[]>) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    return useQuery<WebsiteUser[], ApiError>({
        queryKey: websiteQueryKeys.lists(userId),
        queryFn: () => { if (!userId) return Promise.resolve([]); return fetchUserWebsites(); },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 1000,
        gcTime: 1000 * 60 * 15,
        ...options,
    });
}

/**
 * Custom hook to fetch a single website by its ID for the current user.
 */
export function useUserWebsiteQuery(websiteId: number | undefined, options?: CustomQueryOptions<WebsiteUser>) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    return useQuery<WebsiteUser, ApiError>({
        queryKey: websiteQueryKeys.detail(websiteId, userId),
        queryFn: () => { if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for query")); return fetchUserWebsite(websiteId); },
        enabled: options?.enabled === undefined ? (!!userId && !!websiteId && websiteId > 0) : options.enabled,
        staleTime: 1000,
        gcTime: 1000 * 60 * 5,
        ...options,
    });
}

/**
 * Custom hook for searching websites with local state management.
 */
export function useWebsiteSearch(limit: number = 10) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Website[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);
    const search = useCallback(async (searchQuery: string) => { setQuery(searchQuery); if (!searchQuery.trim()) { setResults([]); return []; } setLoading(true); setError(null); try { const data = await apiSearchWebsites(searchQuery, limit); setResults(data); return data; } catch (err) { setError(err as ApiError); console.error("Error searching websites:", err); setResults([]); return []; } finally { setLoading(false); } }, [limit]);
    return { query, results, loading, error, search };
 }

/**
 * Custom hook providing mutation functions for website actions (add, update, delete, pin, toggle alerts).
 */
export function useWebsiteMutations() {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const userId = auth?.user?.id;
    const { mutateAsync: triggerCheck, isPending: isChecking } = useWebsiteCheckMutation();

    const userWebsiteListKey: QueryKey = websiteQueryKeys.lists(userId);
    const userMonitoringResultsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'userResults', { userId }];
    const userOverallStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'user', { userId }];
    const userAlertListKeyPattern: QueryKey = alertQueryKeys.lists();
    const userAlertStatsKeyPattern: QueryKey = alertQueryKeys.stats();

    const addWebsiteMutation = useMutation<WebsiteUser, ApiError, AddWebsiteUserDTO>({
        mutationFn: (websiteData) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for adding website"));
             return apiAddWebsiteToUser({ ...websiteData, isPinned: websiteData.isPinned ?? false });
        },
        onSuccess: async (newWebsiteUser) => {
            const websiteId = newWebsiteUser?.websiteId;
            if (!userId) return;
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
            if (websiteId) {
                try {
                    await triggerCheck(websiteId);
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

    const updateSettingsMutation = useMutation<WebsiteUser | null, ApiError, { websiteId: number, websiteData: UpdateWebsiteUserDTO }>({
        mutationFn: (vars) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for updating website settings"));
             return apiUpdateUserWebsite(vars);
        },
        onSuccess: (updatedWebsiteUser, variables) => {
            const websiteId = variables.websiteId;
            if (!userId || !updatedWebsiteUser) return;
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.setQueryData(detailKey, updatedWebsiteUser);
            if (variables.websiteData.interval !== undefined) {
                const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
                queryClient.invalidateQueries({ queryKey: websiteStatsKeyPattern });
                queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            }
            if (variables.websiteData.alertEnabled !== undefined || variables.websiteData.alertThreshold !== undefined) {
                 queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
                 queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
            }
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error updating website ${variables.websiteId}:`, error.message);
        },
    });

    const setPinStatusMutation = useMutation<WebsiteUser, ApiError, { websiteId: number; isPinned: boolean }>({
        mutationFn: ({ websiteId, isPinned }) => {
            if (!userId) return Promise.reject(new Error("User not authenticated for setting pin status"));
            const pinData: SetPinStatusDTO = { isPinned };
            return apiSetPinStatus({ websiteId, pinData });
        },
        onSuccess: (updatedWebsiteUser, variables) => {
            const { websiteId } = variables;
            if (!userId || !updatedWebsiteUser) return;
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.setQueryData(detailKey, updatedWebsiteUser);
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error setting pin status for website ${variables.websiteId}:`, error.message);
        },
    });

    const removeWebsiteMutation = useMutation<void, ApiError, number>({
        mutationFn: (websiteId: number) => {
             if (!userId) return Promise.reject(new Error("User not authenticated for removing website"));
             return apiRemoveWebsiteFromUser(websiteId);
        },
        onSuccess: (_, websiteId) => {
            if (!userId) return;
            queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
            const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
            queryClient.removeQueries({ queryKey: detailKey });
            queryClient.invalidateQueries({ queryKey: userMonitoringResultsKeyPattern });
            queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern });
            const websiteStatsKeyPattern: QueryKey = [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: websiteStatsKeyPattern });
            const detailsKeyPatternForUser: QueryKey = [...monitoringQueryKeys.all, 'details', websiteId, { userId }];
            queryClient.removeQueries({ queryKey: detailsKeyPatternForUser, exact: false });
            queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
            queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
        },
        onError: (error, websiteId) => {
            console.error(`[Mutation Error] Error removing website ${websiteId}:`, error.message);
        },
    });

     const toggleAlertEnabledMutation = useMutation<WebsiteUser | null, ApiError, { websiteId: number, currentStatus: boolean }>({
        mutationFn: ({ websiteId, currentStatus }) => {
             if (!userId) return Promise.reject(new Error("User not authenticated"));
             return apiUpdateUserWebsite({ websiteId, websiteData: { alertEnabled: !currentStatus } });
        },
         onSuccess: (updatedWebsiteUser, variables) => {
             if (!userId || !updatedWebsiteUser) return;
             const websiteId = variables.websiteId;
             queryClient.invalidateQueries({ queryKey: userWebsiteListKey });
             const detailKey: QueryKey = websiteQueryKeys.detail(websiteId, userId);
             queryClient.setQueryData(detailKey, updatedWebsiteUser);
             queryClient.invalidateQueries({ queryKey: userAlertListKeyPattern, exact: false });
             queryClient.invalidateQueries({ queryKey: userAlertStatsKeyPattern, exact: false });
        },
        onError: (error, variables) => {
            console.error(`[Mutation Error] Error toggling alert status for website ${variables.websiteId}:`, error.message);
        },
     });

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