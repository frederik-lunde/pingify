// client/src/hooks/api/useIncidents.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Incident, IncidentQueryOptions, IncidentCountResponse, ApiError } from "../../types";
import {
    fetchUserIncidents,
    fetchWebsiteIncidents,
    fetchUserIncidentCountLast24h
} from '../../api/incidentApi';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed

// --- Query Keys ---
export const incidentQueryKeys = {
    all: ['incidents'] as const,
    lists: () => [...incidentQueryKeys.all, 'list'] as const,
    list: (options: IncidentQueryOptions = {}, userId: number | undefined) =>
        [...incidentQueryKeys.lists(), 'user', userId, options] as const,
    website: (websiteId: number | undefined, options: IncidentQueryOptions = {}, userId: number | undefined) =>
        [...incidentQueryKeys.all, 'website', websiteId, userId, options] as const,
    countLast24h: (userId: number | undefined) =>
        [...incidentQueryKeys.all, 'count', 'last24h', userId] as const,
};

// --- Helper type ---
type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

// Default cache times
const DEFAULT_LIST_STALE_TIME = 1000 * 60; // 1 minute
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 10; // 10 minutes
const DEFAULT_COUNT_STALE_TIME = 1000 * 60 * 2; // 2 minutes
const DEFAULT_COUNT_GC_TIME = 1000 * 60 * 10; // 10 minutes

/**
 * Hook to fetch the authenticated user's incidents.
 */
export function useUserIncidentsQuery(
    apiOptions: IncidentQueryOptions = {},
    hookOptions?: CustomQueryOptions<Incident[]>
) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = incidentQueryKeys.list(apiOptions, userId);

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId) return Promise.resolve([]); // Return empty if no user
            return fetchUserIncidents(apiOptions);
        },
        enabled: hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        initialData: [],
        ...hookOptions,
    });
}

/**
 * Hook to fetch incidents for a specific website.
 */
export function useWebsiteIncidentsQuery(
    websiteId: number | undefined,
    apiOptions: IncidentQueryOptions = {},
    hookOptions?: CustomQueryOptions<Incident[]>
) {
    const { user } = useAuth();
    const userId = user?.id; // Needed for query key uniqueness per user
    const queryKey = incidentQueryKeys.website(websiteId, apiOptions, userId);
    const isQueryEnabled = (hookOptions?.enabled === undefined ? true : hookOptions.enabled)
                           && !!userId && typeof websiteId === 'number' && websiteId > 0;

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!websiteId) return Promise.resolve([]); // Should not happen if enabled logic is correct
            return fetchWebsiteIncidents(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        initialData: [],
        ...hookOptions,
    });
}

/**
 * Hook to fetch the count of user incidents started in the last 24 hours.
 */
export function useUserIncidentCountLast24hQuery(
    hookOptions?: CustomQueryOptions<IncidentCountResponse>
) {
    const { user } = useAuth();
    const userId = user?.id;
    const queryKey = incidentQueryKeys.countLast24h(userId);

    return useQuery<IncidentCountResponse, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId) return Promise.resolve({ incidentCount: 0 }); // Default if no user
            return fetchUserIncidentCountLast24h();
        },
        enabled: hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_COUNT_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_COUNT_GC_TIME,
        // Provide a default structure for initialData to avoid issues with destructuring
        initialData: () => ({ incidentCount: 0 }),
        ...hookOptions,
    });
}

// No mutation actions (like resolving incidents) are defined for the frontend yet.
// If needed, a useIncidentActions hook could be created similar to useAlertActions.