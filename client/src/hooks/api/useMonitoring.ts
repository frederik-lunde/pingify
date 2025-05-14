
import {
    useQuery,
    useMutation,
    useQueryClient,
    UseQueryOptions,
    QueryFilters 
} from '@tanstack/react-query';
import {
    fetchWebsiteDetails,
    triggerWebsiteCheck,
    fetchUserStats,
    fetchWebsiteStats,
    FetchWebsiteDetailsParams,
    
    
} from '../../api/monitoringApi';
import {
    WebsiteDetailsData,
    OverallStats,
    WebsiteStatsData,
    MonitoringResult,
    ApiError,
    TimeframeKey,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { incidentQueryKeys } from './useIncidents';
import { alertQueryKeys } from './useAlerts';
import { websiteQueryKeys } from './useWebsites';

/**
 * Defines query keys for monitoring-related data.
 */
export const monitoringQueryKeys = {
    all: ['monitoring'] as const,
    details: (params: FetchWebsiteDetailsParams, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'details', params.websiteId, { userId, ...params }] as const,
    userStats: (period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'user', { userId, period }] as const,
    websiteStats: (websiteId: number | undefined, period: TimeframeKey | string, userId: string | undefined) =>
        [...monitoringQueryKeys.all, 'stats', 'website', websiteId, { userId, period }] as const,
    
    
    userResults: (limit: number | undefined, userId: string | undefined) => 
        [...monitoringQueryKeys.all, 'userResults', { userId, limit }] as const,

    
    
    websiteResults: (websiteId: number | undefined, userId?: string | undefined, params?: { limit?: number, from?: string, to?: string }) =>
        [...monitoringQueryKeys.all, 'websiteResults', websiteId, { userId, ...params }] as const,
};

type CustomQueryOptions<TQueryFnData, TError = ApiError> = Omit<
    UseQueryOptions<TQueryFnData, TError>,
    'queryKey' | 'queryFn'
>;

/**
 * Custom hook to fetch detailed information for a specific website.
 * (This fetches WebsiteDetailsData, which includes recent checks, but is a different query key)
 */
export function useWebsiteDetailsQuery(params: FetchWebsiteDetailsParams, options?: CustomQueryOptions<WebsiteDetailsData>) {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const queryKey = monitoringQueryKeys.details(params, userId);

    return useQuery<WebsiteDetailsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !params.websiteId) return Promise.reject(new Error("Missing user or website ID for query"));
            return fetchWebsiteDetails(params); 
        },
        enabled: options?.enabled === undefined ? (!!userId && !!params.websiteId && params.websiteId > 0) : options.enabled,
        staleTime: 1000 * 30, 
        gcTime: 1000 * 60 * 5,  
        ...options,
    });
}




/**
 * Custom hook for triggering an on-demand check for a website.
 */
export function useWebsiteCheckMutation() {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const userId = auth?.user?.id;

    
    const userIncidentListKeyPattern = incidentQueryKeys.list({}, userId); 
    const userIncidentCountKey = incidentQueryKeys.countLast24h(userId);
    const userOverallStatsKeyPattern = monitoringQueryKeys.userStats('week', userId); 
    const userWebsiteListKeyPattern = websiteQueryKeys.lists(userId);


    return useMutation<MonitoringResult, ApiError, number>({ 
        mutationFn: (websiteId: number) => {
             if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
                return Promise.reject(new Error("Invalid Website ID provided."));
            }
            return triggerWebsiteCheck(websiteId);
        },
        
        
        onSuccess: (data, websiteId) => { 
            if (userId) {
                console.log(`Check successful for website ${websiteId}, invalidating relevant queries.`);
                
                
                const detailsKeyPrefix: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'details', websiteId];
                queryClient.invalidateQueries({ queryKey: detailsKeyPrefix, exact: false });

                
                const websiteStatsKeyPrefix: QueryFilters['queryKey'] = [...monitoringQueryKeys.all, 'stats', 'website', websiteId];
                queryClient.invalidateQueries({ queryKey: websiteStatsKeyPrefix, exact: false });

                
                queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.websiteResults(websiteId, userId), exact: false });


                
                queryClient.invalidateQueries({ queryKey: userOverallStatsKeyPattern, exact: false }); 
                queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.userResults(undefined, userId), exact: false });


                queryClient.invalidateQueries({ queryKey: userWebsiteListKeyPattern }); 
                queryClient.invalidateQueries({ queryKey: userIncidentListKeyPattern, exact: false });
                queryClient.invalidateQueries({ queryKey: userIncidentCountKey });
                queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists(), exact: false }); 
                queryClient.invalidateQueries({ queryKey: alertQueryKeys.stats(), exact: false }); 
            } else {
                console.warn("[Invalidation Skipped] User ID not available, cannot invalidate user-specific caches.");
            }
        },
        onError: (error: ApiError, websiteId) => {
            console.error(`[Mutation Error] Failed to trigger check for website ${websiteId}:`, error.message || error);
        },
    });
}

/**
 * Custom hook to fetch overall monitoring statistics for the user.
 */
export function useUserStatsQuery(period: TimeframeKey | string = 'week', options?: CustomQueryOptions<OverallStats>) {
    const auth = useAuth();
    const userId = auth?.user?.id;

    return useQuery<OverallStats, ApiError>({
        queryKey: monitoringQueryKeys.userStats(period, userId),
        queryFn: () => {
            if (!userId) return Promise.reject(new Error("User ID not found for user stats query"));
            return fetchUserStats(period);
        },
        enabled: options?.enabled === undefined ? !!userId : options.enabled,
        staleTime: 60 * 1000, 
        gcTime: 1000 * 60 * 15, 
        ...options,
    });
}

/**
 * Custom hook to fetch monitoring statistics for a specific website.
 */
export function useWebsiteStatsQuery(websiteId: number | undefined, period: TimeframeKey | string = 'week', options?: CustomQueryOptions<WebsiteStatsData>) {
    const auth = useAuth();
    const userId = auth?.user?.id; 
    const queryKey = monitoringQueryKeys.websiteStats(websiteId, period, userId);
    
    const isQueryEnabled = (options?.enabled === undefined ? true : options.enabled) && (!!userId && !!websiteId && websiteId > 0);

    return useQuery<WebsiteStatsData, ApiError>({
        queryKey: queryKey,
        queryFn: () => {
            if (!userId || !websiteId) return Promise.reject(new Error("Missing user or website ID for website stats query"));
            return fetchWebsiteStats(websiteId, period);
        },
        enabled: isQueryEnabled,
        staleTime: 60 * 1000, 
        gcTime: 1000 * 60 * 10, 
        ...options,
    });
}