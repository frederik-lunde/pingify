/* eslint-disable no-console */ // Allow console logs for debugging
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

    // Calculate enabled state explicitly
    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;

    // Log userId and calculated enabled state
    console.log(`[useUserIncidentsQuery] Hook called. userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // This check prevents the API call if userId isn't available yet,
            // matching the 'enabled' logic behavior.
            if (!userId) {
                console.warn('[useUserIncidentsQuery] Query function called but userId is missing. Returning empty array.');
                return Promise.resolve([]);
            }

            // Log just before making the API call
            console.log(`[useUserIncidentsQuery] queryFn executing: Firing API call for user ${userId} with options:`, JSON.stringify(apiOptions));

            return fetchUserIncidents(apiOptions);
        },
        // Use the calculated enabled state
        enabled: isQueryEnabled,
        // Keep other options
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        // --- REMOVED initialData to ensure immediate fetch on enable ---
        // initialData: [],
        // ---
        ...hookOptions, // Spread any other passed hook options
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

    // Calculate enabled state
    const isQueryEnabled = (hookOptions?.enabled === undefined ? true : hookOptions.enabled)
                           && !!userId && typeof websiteId === 'number' && websiteId > 0;

    console.log(`[useWebsiteIncidentsQuery] Hook called. websiteId: ${websiteId}, userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);


    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // Should not happen if enabled logic is correct, but good safeguard
            if (!websiteId) {
                 console.warn('[useWebsiteIncidentsQuery] Query function called but websiteId is missing. Returning empty array.');
                 return Promise.resolve([]);
            }
             console.log(`[useWebsiteIncidentsQuery] queryFn executing: Firing API call for website ${websiteId}, user ${userId} with options:`, JSON.stringify(apiOptions));
            return fetchWebsiteIncidents(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        // --- REMOVED initialData to ensure immediate fetch on enable ---
        // initialData: [],
        // ---
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

    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;
    console.log(`[useUserIncidentCountLast24hQuery] Hook called. userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);

    return useQuery<IncidentCountResponse, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId) {
                 console.warn('[useUserIncidentCountLast24hQuery] Query function called but userId is missing. Returning default count.');
                 return Promise.resolve({ incidentCount: 0 });
            }
             console.log(`[useUserIncidentCountLast24hQuery] queryFn executing: Firing API call for user ${userId}`);
            return fetchUserIncidentCountLast24h();
        },
        enabled: isQueryEnabled,
        refetchInterval: hookOptions?.refetchInterval,
        staleTime: hookOptions?.staleTime ?? DEFAULT_COUNT_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_COUNT_GC_TIME,
        // Keep initialData for the count query, it's less problematic here
        initialData: () => ({ incidentCount: 0 }),
        ...hookOptions,
    });
}