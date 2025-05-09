import apiClient from './client';
import { Incident, IncidentQueryOptions, IncidentCountResponse, ApiError } from '../types';

/**
 * Builds query parameters object from incident options.
 */
const buildIncidentQueryParams = (options: IncidentQueryOptions): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.type !== undefined) params.type = options.type;
    if (options.from instanceof Date) params.from = options.from.toISOString();
    if (options.to instanceof Date) params.to = options.to.toISOString();
    if (options.websiteId !== undefined) params.websiteId = options.websiteId;
    if (options.status !== undefined) params.status = options.status;
    return params;
};

/**
 * Logs API errors with additional context.
 */
const logApiError = (error: unknown, context: string): void => {
    if (error instanceof Error) {
        if ('name' in error && error.name === 'ApiError' && 'status' in error && 'url' in error && 'method' in error) {
            const apiError = error as ApiError;
            console.error(`API Error (${apiError.status ?? 'Unknown'}) ${context}: ${apiError.message} on ${apiError.method} ${apiError.url}`);
        } else {
            console.error(`Error ${context}: ${error.message}`);
        }
    } else {
        console.error(`Non-Error Thrown ${context}:`, error);
    }
};

/**
 * Fetches incidents for the current user.
 */
export const fetchUserIncidents = async (options: IncidentQueryOptions = {}): Promise<Incident[]> => {
    const url = "/incidents/user";
    try {
        const params = buildIncidentQueryParams(options);
        const data = await apiClient.get<Incident[]>(url, { params });
        return data ?? [];
    } catch (error) {
        logApiError(error, 'fetching user incidents');
        throw error;
    }
};

/**
 * Fetches incidents for a specific website.
 */
export const fetchWebsiteIncidents = async (websiteId: number, options: IncidentQueryOptions = {}): Promise<Incident[]> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
        throw new Error("Valid Website ID is required for fetching website incidents.");
    }
    const url = `/incidents/website/${websiteId}`;
    try {
        const params = buildIncidentQueryParams({ ...options, websiteId: undefined });
        const data = await apiClient.get<Incident[]>(url, { params });
        return data ?? [];
    } catch (error) {
        logApiError(error, `fetching incidents for website ${websiteId}`);
        throw error;
    }
};

/**
 * Fetches the count of user incidents in the last 24 hours.
 */
export const fetchUserIncidentCountLast24h = async (): Promise<IncidentCountResponse> => {
    const url = "/incidents/user/count/last24h";
    try {
        const data = await apiClient.get<IncidentCountResponse>(url);
        return data ?? { incidentCount: 0 };
    } catch (error) {
        logApiError(error, 'fetching user incident count (last 24h)');
        throw error;
    }
};