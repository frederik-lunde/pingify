// client/src/api/alertApi.ts
import apiClient from './client';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from '../types';

/**
 * Constructs query parameters object, omitting undefined values.
 */
const buildAlertQueryParams = (options: AlertQueryOptions): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.type !== undefined) params.type = options.type;
    if (options.from instanceof Date) params.from = options.from.toISOString();
    if (options.to instanceof Date) params.to = options.to.toISOString();
    if (options.websiteId !== undefined) params.websiteId = options.websiteId;
    return params;
};

/**
 * Helper to log API errors (interceptor already creates/rejects with ApiError).
 * Accepts 'unknown' and performs type checks.
 */
const logApiError = (error: unknown, context: string): void => {
    // Check if it looks like our custom ApiError or a standard Error
    if (error instanceof Error) {
        // Further check if it has properties specific to ApiError (duck typing)
        if ('status' in error && 'url' in error && 'method' in error) {
            const apiError = error as ApiError; // Safe cast after checks
            console.error(`API Error (${apiError.status ?? 'Unknown'}) ${context}: ${apiError.message} on ${apiError.method} ${apiError.url}`);
        } else {
            // Standard Error (e.g., network error before reaching server)
            console.error(`Error ${context}: ${error.message}`);
        }
    } else {
        // Handle cases where the thrown value is not an Error object
        console.error(`Non-Error Thrown ${context}:`, error);
    }
};


/**
 * Fetches alerts for the authenticated user based on query options.
 * Endpoint: GET /alerts/user
 */
export const fetchUserAlerts = async (options: AlertQueryOptions = {}): Promise<Alert[]> => {
    const url = "/alerts/user";
    try {
        const params = buildAlertQueryParams(options);
        const data = await apiClient.get<Alert[]>(url, { params });
        return data ?? [];
    } catch (error) { // Let TypeScript infer 'unknown'
        logApiError(error, 'fetching user alerts');
        // Re-throw the original error after logging
        // The interceptor likely already transformed it into an ApiError
        throw error;
    }
};

/**
 * Fetches alerts related to a specific website ID.
 * Endpoint: GET /alerts/website/:websiteId
 */
export const fetchWebsiteAlerts = async (websiteId: number, options: AlertQueryOptions = {}): Promise<Alert[]> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
        // Throw a standard Error for invalid input before API call
        throw new Error("Valid Website ID is required for fetching website alerts.");
    }
    const url = `/alerts/website/${websiteId}`;
    try {
        const params = buildAlertQueryParams(options);
        const data = await apiClient.get<Alert[]>(url, { params });
        return data ?? [];
    } catch (error) { // Let TypeScript infer 'unknown'
        logApiError(error, `fetching alerts for website ${websiteId}`);
        throw error;
    }
};

/**
 * Fetches alert statistics for the authenticated user.
 * Endpoint: GET /alerts/user/stats
 */
export const fetchAlertStats = async (days: number = 7): Promise<AlertStats> => {
    const url = "/alerts/user/stats";
    try {
        const data = await apiClient.get<AlertStats>(url, { params: { days } });
        // Provide a default structure if API returns null/undefined unexpectedly
        return data ?? { totalAlerts: 0, byType: {}, byWebsite: [] };
    } catch (error) { // Let TypeScript infer 'unknown'
        logApiError(error, 'fetching alert stats');
        throw error;
    }
};

/**
 * Dismisses (deletes) a specific alert for the authenticated user.
 * Endpoint: DELETE /alerts/:alertId
 */
export const dismissAlert = async (alertId: number): Promise<void> => {
    if (!alertId || isNaN(alertId) || alertId <= 0) {
        // Throw a standard Error for invalid input before API call
        throw new Error("Valid Alert ID is required for dismissing an alert.");
    }
    const url = `/alerts/${alertId}`;
    try {
        // Assuming apiClient.delete correctly handles a void response
        await apiClient.delete<void>(url);
    } catch (error) { // Let TypeScript infer 'unknown'
        logApiError(error, `dismissing alert ${alertId}`);
        throw error;
    }
};