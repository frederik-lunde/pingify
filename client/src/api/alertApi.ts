import apiClient from './client';
import { Alert, AlertStats, AlertQueryOptions, ApiError } from '../types';

/**
 * Builds query parameters object from alert options.
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
 * Logs API errors with additional context.
 */
const logApiError = (error: unknown, context: string): void => {
    if (error instanceof Error) {
        if ('status' in error && 'url' in error && 'method' in error) {
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
 * Fetches alerts for the current user.
 */
export const fetchUserAlerts = async (options: AlertQueryOptions = {}): Promise<Alert[]> => {
    const url = "/alerts/user";
    try {
        const params = buildAlertQueryParams(options);
        const data = await apiClient.get<Alert[]>(url, { params });
        return data ?? [];
    } catch (error) {
        logApiError(error, 'fetching user alerts');
        throw error;
    }
};

/**
 * Fetches alerts for a specific website.
 */
export const fetchWebsiteAlerts = async (websiteId: number, options: AlertQueryOptions = {}): Promise<Alert[]> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
        throw new Error("Valid Website ID is required for fetching website alerts.");
    }
    const url = `/alerts/website/${websiteId}`;
    try {
        const params = buildAlertQueryParams(options);
        const data = await apiClient.get<Alert[]>(url, { params });
        return data ?? [];
    } catch (error) {
        logApiError(error, `fetching alerts for website ${websiteId}`);
        throw error;
    }
};

/**
 * Fetches statistics about user alerts.
 */
export const fetchAlertStats = async (days: number = 7): Promise<AlertStats> => {
    const url = "/alerts/user/stats";
    try {
        const data = await apiClient.get<AlertStats>(url, { params: { days } });
        return data ?? { totalAlerts: 0, byType: {}, byWebsite: [] };
    } catch (error) {
        logApiError(error, 'fetching alert stats');
        throw error;
    }
};

/**
 * Dismisses a specific alert by its ID.
 */
export const dismissAlert = async (alertId: number): Promise<void> => {
    if (!alertId || isNaN(alertId) || alertId <= 0) {
        throw new Error("Valid Alert ID is required for dismissing an alert.");
    }
    const url = `/alerts/${alertId}`;
    try {
        await apiClient.delete<void>(url);
    } catch (error) {
        logApiError(error, `dismissing alert ${alertId}`);
        throw error;
    }
};