// client/src/api/incidentApi.ts
import apiClient from './client';
import { Incident, IncidentQueryOptions, IncidentCountResponse, ApiError } from '../types';

/**
 * Constructs query parameters object for incident endpoints, omitting undefined values.
 */
const buildIncidentQueryParams = (options: IncidentQueryOptions): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.type !== undefined) params.type = options.type;
    if (options.from instanceof Date) params.from = options.from.toISOString();
    if (options.to instanceof Date) params.to = options.to.toISOString();
    if (options.websiteId !== undefined) params.websiteId = options.websiteId;
    if (options.status !== undefined) params.status = options.status;
    // userId is typically handled by the backend via authentication, but included if needed for specific admin endpoints
    // if (options.userId !== undefined) params.userId = options.userId;
    return params;
};

/**
 * Helper to log API errors (interceptor already creates/rejects with ApiError).
 */
const logApiError = (error: any, context: string): void => {
    if (error instanceof Error && 'status' in error && 'url' in error) {
        const apiError = error as ApiError;
         console.error(`API Error (${apiError.status ?? 'Unknown'}) ${context}: ${apiError.message} on ${apiError.method} ${apiError.url}`);
    } else {
        console.error(`API Error (Unexpected Type) ${context}:`, error);
    }
};

/**
 * Fetches incidents for the authenticated user's monitored websites.
 * Endpoint: GET /incidents/user
 */
export const fetchUserIncidents = async (options: IncidentQueryOptions = {}): Promise<Incident[]> => {
    const url = "/incidents/user";
    try {
        const params = buildIncidentQueryParams(options);
        const data = await apiClient.get<Incident[]>(url, { params });
        return data ?? [];
    } catch (error: any) {
        logApiError(error, 'fetching user incidents');
        throw error;
    }
};

/**
 * Fetches incidents for a specific website (requires user access).
 * Endpoint: GET /incidents/website/:websiteId
 */
export const fetchWebsiteIncidents = async (websiteId: number, options: IncidentQueryOptions = {}): Promise<Incident[]> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
        throw new Error("Valid Website ID is required for fetching website incidents.");
    }
    const url = `/incidents/website/${websiteId}`;
    try {
        // Ensure websiteId from path param isn't overridden by options
        const params = buildIncidentQueryParams({ ...options, websiteId: undefined });
        const data = await apiClient.get<Incident[]>(url, { params });
        return data ?? [];
    } catch (error: any) {
        logApiError(error, `fetching incidents for website ${websiteId}`);
        throw error;
    }
};

/**
 * Fetches the count of incidents started in the last 24 hours for the user.
 * Endpoint: GET /incidents/user/count/last24h
 */
export const fetchUserIncidentCountLast24h = async (): Promise<IncidentCountResponse> => {
    const url = "/incidents/user/count/last24h";
    try {
        const data = await apiClient.get<IncidentCountResponse>(url);
        // Ensure a valid response structure even if API returns null/undefined
        return data ?? { incidentCount: 0 };
    } catch (error: any) {
        logApiError(error, 'fetching user incident count (last 24h)');
        // Provide a default error response structure
        throw error; // Re-throw the original ApiError
    }
};