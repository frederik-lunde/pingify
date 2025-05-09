import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Incident, IncidentQueryOptions, IncidentCountResponse, ApiError } from "../../types";
import {
    fetchUserIncidents,
    fetchWebsiteIncidents,
    fetchUserIncidentCountLast24h
} from '../../api/incidentApi';
import { useAuth } from '../../context/AuthContext';

/**
 * Defines query keys for incident-related data.
 */
export const incidentQueryKeys = {
    all: ['incidents'] as const,
    lists: () => [...incidentQueryKeys.all, 'list'] as const,
    list: (options: IncidentQueryOptions = {}, userId: string | undefined) =>
        [...incidentQueryKeys.lists(), 'user', userId, options] as const,
    website: (websiteId: number | undefined, options: IncidentQueryOptions = {}, userId: string | undefined) =>
        [...incidentQueryKeys.all, 'website', websiteId, userId, options] as const,
    countLast24h: (userId: string | undefined) =>
        [...incidentQueryKeys.all, 'count', 'last24h', userId] as const,
};

type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

const DEFAULT_LIST_STALE_TIME = 1000 * 60;
const DEFAULT_LIST_GC_TIME = 1000 * 60 * 10;
const DEFAULT_COUNT_STALE_TIME = 1000 * 60 * 2;
const DEFAULT_COUNT_GC_TIME = 1000 * 60 * 10;

/**
 * Custom hook to fetch user incidents with TanStack Query.
 */
export function useUserIncidentsQuery(
    apiOptions: IncidentQueryOptions = {},
    hookOptions?: CustomQueryOptions<Incident[]>
) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.list(apiOptions, userId);
    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId) {
                return Promise.resolve([]);
            }
            return fetchUserIncidents(apiOptions);
        },
        enabled: isQueryEnabled,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        ...hookOptions,
    });
}

/**
 * Custom hook to fetch incidents for a specific website with TanStack Query.
 */
export function useWebsiteIncidentsQuery(
    websiteId: number | undefined,
    apiOptions: IncidentQueryOptions = {},
    hookOptions?: CustomQueryOptions<Incident[]>
) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.website(websiteId, apiOptions, userId);
    const isQueryEnabled = (hookOptions?.enabled === undefined ? true : hookOptions.enabled)
                           && !!userId && typeof websiteId === 'number' && websiteId > 0;

    return useQuery<Incident[], ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!websiteId || !userId) {
                 return Promise.resolve([]);
            }
            return fetchWebsiteIncidents(websiteId, apiOptions);
        },
        enabled: isQueryEnabled,
        staleTime: hookOptions?.staleTime ?? DEFAULT_LIST_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_LIST_GC_TIME,
        ...hookOptions,
    });
}

/**
 * Custom hook to fetch the count of user incidents in the last 24 hours.
 */
export function useUserIncidentCountLast24hQuery(
    hookOptions?: CustomQueryOptions<IncidentCountResponse>
) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const queryKey = incidentQueryKeys.countLast24h(userId);
    const isQueryEnabled = hookOptions?.enabled === undefined ? !!userId : hookOptions.enabled;

    return useQuery<IncidentCountResponse, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId) {
                 return Promise.resolve({ incidentCount: 0 });
            }
            return fetchUserIncidentCountLast24h();
        },
        enabled: isQueryEnabled,
        staleTime: hookOptions?.staleTime ?? DEFAULT_COUNT_STALE_TIME,
        gcTime: hookOptions?.gcTime ?? DEFAULT_COUNT_GC_TIME,
        initialData: () => ({ incidentCount: 0 }),
        ...hookOptions,
    });
}