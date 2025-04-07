// src/api/alertApi.ts
import apiClient from './client'; // Your configured axios instance which returns data directly
// Import types from the *updated* types file
import { Alert, AlertStats, AlertQueryOptions, ApiError } from '../types'; // Adjust path as needed

/**
 * Constructs query parameters object, omitting undefined values.
 */
const buildAlertQueryParams = (options: AlertQueryOptions): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.type !== undefined) params.type = options.type;
    // Convert Dates from query options to ISO strings for the API call
    if (options.from instanceof Date) params.from = options.from.toISOString();
    if (options.to instanceof Date) params.to = options.to.toISOString();
    if (options.websiteId !== undefined) params.websiteId = options.websiteId;
    return params;
};

/**
 * Helper to log API errors (interceptor already creates/rejects with ApiError).
 */
const logApiError = (error: any, context: string): void => {
    // Check if it's the structured ApiError from the interceptor
    if (error instanceof Error && 'status' in error && 'url' in error) {
        const apiError = error as ApiError;
         console.error(`API Error (${apiError.status ?? 'Unknown'}) ${context}: ${apiError.message} on ${apiError.method} ${apiError.url}`);
    } else {
        // Log generic errors
        console.error(`API Error (Unexpected Type) ${context}:`, error);
    }
};


/**
 * Fetches alerts for the authenticated user based on query options.
 * Endpoint: GET /alerts/user
 * **Uses apiClient which returns data directly**
 */
export const fetchUserAlerts = async (options: AlertQueryOptions = {}): Promise<Alert[]> => {
    const url = "/alerts/user";
    try {
        const params = buildAlertQueryParams(options);
        // apiClient.get ALREADY returns the data (Alert[]) directly
        const data = await apiClient.get<Alert[]>(url, { params });
        // Return the data or empty array if client returns null/undefined for some reason
        return data ?? [];
    } catch (error: any) {
        // The interceptor already formats and rejects with ApiError
        logApiError(error, 'fetching user alerts');
        throw error; // Re-throw the ApiError from the interceptor
    }
};

/**
 * Fetches alerts related to a specific website ID.
 * Endpoint: GET /alerts/website/:websiteId
 * **Uses apiClient which returns data directly**
 */
export const fetchWebsiteAlerts = async (websiteId: number, options: AlertQueryOptions = {}): Promise<Alert[]> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
        // Throwing here prevents the API call and can be caught by React Query
        throw new Error("Valid Website ID is required for fetching website alerts.");
    }
    const url = `/alerts/website/${websiteId}`;
    try {
        const params = buildAlertQueryParams(options);
        // apiClient.get ALREADY returns the data (Alert[]) directly
        const data = await apiClient.get<Alert[]>(url, { params });
        return data ?? [];
    } catch (error: any) {
        logApiError(error, `fetching alerts for website ${websiteId}`);
        throw error; // Re-throw the ApiError from the interceptor
    }
};

/**
 * Fetches alert statistics for the authenticated user.
 * Endpoint: GET /alerts/user/stats
 * **Uses apiClient which returns data directly**
 */
export const fetchAlertStats = async (days: number = 7): Promise<AlertStats> => {
    const url = "/alerts/user/stats";
    try {
        // apiClient.get ALREADY returns the data (AlertStats) directly
        const data = await apiClient.get<AlertStats>(url, { params: { days } });
        // Return the data, providing a default structure if the client returns null/undefined
        return data ?? { totalAlerts: 0, byType: {}, byWebsite: [] };
    } catch (error: any) {
        logApiError(error, 'fetching alert stats');
        throw error; // Re-throw the ApiError from the interceptor
    }
};

/**
 * Dismisses (deletes) a specific alert for the authenticated user.
 * Endpoint: DELETE /alerts/:alertId
 * **Uses apiClient which returns data (likely null/undefined for 204) directly**
 */
export const dismissAlert = async (alertId: number): Promise<void> => {
    if (!alertId || isNaN(alertId) || alertId <= 0) {
        throw new Error("Valid Alert ID is required for dismissing an alert.");
    }
    const url = `/alerts/${alertId}`;
    try {
        // apiClient.delete returns response.data. Since backend sends 204,
        // response.data will likely be undefined or null. The void return type handles this.
        // We don't need to store or use the return value here.
        await apiClient.delete<void>(url);
    } catch (error: any) {
        logApiError(error, `dismissing alert ${alertId}`);
        throw error; // Re-throw the ApiError from the interceptor
    }
};