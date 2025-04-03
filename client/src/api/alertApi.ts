// src/api/alertApi.ts
// No changes needed based on the request, TanStack Query integration happens in hooks.
import apiClient from './client';
import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../types'; // Removed ApiError import as it's not directly used here

/**
 * Fetches alerts for the authenticated user based on query options.
 * Endpoint: GET /alerts/user
 */
export const fetchUserAlerts = async (options: AlertQueryOptions = {}): Promise<Alert[]> => {
    const { limit = 50, type, from, to, isResolved, isRead } = options;
    const params: any = { limit };
    if (type) params.type = type;
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    if (isResolved !== undefined) params.isResolved = isResolved;
    if (isRead !== undefined) params.isRead = isRead;

    // Assuming API returns Alert[] directly for this endpoint
    return await apiClient.get<Alert[]>("/alerts/user", { params });
};

/**
 * Fetches unread alerts specifically associated with the authenticated user.
 * Endpoint: GET /alerts/user/unread
 */
export const fetchUserUnreadAlerts = async (options: AlertQueryOptions = {}): Promise<AlertUser[]> => {
    const { limit = 50, type, from, to, isResolved } = options; // isRead is implicit here
    const params: any = { limit };
    if (type) params.type = type;
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    if (isResolved !== undefined) params.isResolved = isResolved;

    // This endpoint returns AlertUser[] which includes the nested Alert object
    const result = await apiClient.get<AlertUser[]>("/alerts/user/unread", { params });
    // Ensure result is always an array, return empty array if null/undefined
    return result ?? [];
};

/**
 * Fetches alerts related to a specific website ID.
 * Endpoint: GET /alerts/website/:websiteId
 */
export const fetchWebsiteAlerts = async (websiteId: number, options: AlertQueryOptions = {}): Promise<Alert[]> => {
    if (!websiteId) throw new Error("Website ID is required to fetch website alerts.");

    const { limit = 50, type, from, to, isResolved } = options;
    const params: any = { limit };
    if (type) params.type = type;
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    if (isResolved !== undefined) params.isResolved = isResolved;

    // Assuming API returns Alert[] directly for this endpoint
    return await apiClient.get<Alert[]>(`/alerts/website/${websiteId}`, { params });
};

/**
 * Fetches alert statistics for the authenticated user.
 * Endpoint: GET /alerts/user/stats
 */
export const fetchAlertStats = async (days: number = 7): Promise<AlertStats> => {
    return await apiClient.get<AlertStats>("/alerts/user/stats", { params: { days } });
};

/**
 * Marks a specific alert as read for the authenticated user.
 * Endpoint: POST /alerts/user/read/:alertId
 */
export const markAlertAsRead = async (alertId: number): Promise<void> => {
     if (!alertId) throw new Error("Alert ID is required to mark an alert as read.");
    // Assuming this endpoint returns no content (204) on success
    await apiClient.post<void>(`/alerts/user/read/${alertId}`);
};

/**
 * Marks all unread alerts as read for the authenticated user.
 * Endpoint: POST /alerts/user/read-all
 */
export const markAllAlertsAsRead = async (): Promise<void> => {
    // Assuming this endpoint returns no content (204) on success
    await apiClient.post<void>("/alerts/user/read-all");
};