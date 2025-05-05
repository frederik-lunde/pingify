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
    // userId type remains string | undefined
    list: (options: IncidentQueryOptions = {}, userId: string | undefined) =>
        [...incidentQueryKeys.lists(), 'user', userId, options] as const,
    website: (websiteId: number | undefined, options: IncidentQueryOptions = {}, userId: string | undefined) =>
        [...incidentQueryKeys.all, 'website', websiteId, userId, options] as const,
    countLast24h: (userId: string | undefined) =>
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
    // Get the auth object (might be null)
    const auth = useAuth();
    // Use optional chaining to safely get userId
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.list(apiOptions, userId);

    // Enable query only if userId exists (and hookOptions.enabled isn't false)
    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;
    // console.log(`[useUserIncidentsQuery] Hook called. userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // Guard remains the same: queryFn shouldn't run if not enabled (userId missing)
            if (!userId) {
                // console.warn('[useUserIncidentsQuery] Query function called but userId is missing. Returning empty array.');
                return Promise.resolve([]); // Should ideally not be reached if 'enabled' works
            }
            // console.log(`[useUserIncidentsQuery] queryFn executing: Firing API call for user ${userId} with options:`, JSON.stringify(apiOptions));
            return fetchUserIncidents(apiOptions);
        },
        enabled: isQueryEnabled, // Use the calculated enabled state
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        ...hookOptions, // Spread other options like refetchInterval
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
    // Get the auth object (might be null)
    const auth = useAuth();
    // Use optional chaining to safely get userId
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.website(websiteId, apiOptions, userId);

    // Enable query only if userId and a valid websiteId exist (and hookOptions.enabled isn't false)
    const isQueryEnabled = (hookOptions?.enabled === undefined ? true : hookOptions.enabled)
                           && !!userId && typeof websiteId === 'number' && websiteId > 0;
    // console.log(`[useWebsiteIncidentsQuery] Hook called. websiteId: ${websiteId}, userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // Guard remains the same: queryFn shouldn't run if not enabled
            if (!websiteId || !userId) {
                 // console.warn('[useWebsiteIncidentsQuery] Query function called but websiteId or userId is missing. Returning empty array.');
                 return Promise.resolve([]); // Should ideally not be reached
            }
             // console.log(`[useWebsiteIncidentsQuery] queryFn executing: Firing API call for website ${websiteId}, user ${userId} with options:`, JSON.stringify(apiOptions));
            return fetchWebsiteIncidents(websiteId, apiOptions);
        },
        enabled: isQueryEnabled, // Use the calculated enabled state
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        ...hookOptions, // Spread other options like refetchInterval
    });
}

/**
 * Hook to fetch the count of user incidents started in the last 24 hours.
 */
export function useUserIncidentCountLast24hQuery(
    hookOptions?: CustomQueryOptions<IncidentCountResponse>
) {
    // Get the auth object (might be null)
    const auth = useAuth();
    // Use optional chaining to safely get userId
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.countLast24h(userId);

    // Enable query only if userId exists (and hookOptions.enabled isn't false)
    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;
    // console.log(`[useUserIncidentCountLast24hQuery] Hook called. userId: ${userId}, calculated enabled state: ${isQueryEnabled}`);

    return useQuery<IncidentCountResponse, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            // Guard remains the same
            if (!userId) {
                 // console.warn('[useUserIncidentCountLast24hQuery] Query function called but userId is missing. Returning default count.');
                 return Promise.resolve({ incidentCount: 0 }); // Should ideally not be reached
            }
             // console.log(`[useUserIncidentCountLast24hQuery] queryFn executing: Firing API call for user ${userId}`);
            return fetchUserIncidentCountLast24h();
        },
        enabled: isQueryEnabled, // Use the calculated enabled state
        staleTime: hookOptions?.staleTime ?? DEFAULT_COUNT_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_COUNT_GC_TIME,
        initialData: () => ({ incidentCount: 0 }), // Keep initial data structure
        ...hookOptions, // Spread other options like refetchInterval
    });
}