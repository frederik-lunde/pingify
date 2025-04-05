import apiClient from './client';
import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../types';

/**
 * Fetches alerts for the authenticated user based on query options.
 * Endpoint: GET /alerts/user
 */
export const fetchUserAlerts = async (options: AlertQueryOptions = {}): Promise<Alert[]> => {
    // ... (implementation remains the same)
    const params: any = { /* ... construct params ... */ };
    return (await apiClient.get<Alert[]>("/alerts/user", { params })) ?? []; // Ensure array return
};

/**
 * Fetches unread alerts specifically associated with the authenticated user.
 * Endpoint: GET /alerts/user/unread
 * Returns AlertUser[] which include the nested Alert object.
 */
export const fetchUserUnreadAlerts = async (options: AlertQueryOptions = {}): Promise<AlertUser[]> => {
    // ... (implementation remains the same)
    const params: any = { /* ... construct params ... */ };
    // API returns AlertUser[] directly
    return (await apiClient.get<AlertUser[]>("/alerts/user/unread", { params })) ?? []; // Ensure array return
};

/**
 * Fetches alerts related to a specific website ID.
 * Endpoint: GET /alerts/website/:websiteId
 */
export const fetchWebsiteAlerts = async (websiteId: number, options: AlertQueryOptions = {}): Promise<Alert[]> => {
    // ... (implementation remains the same)
    if (!websiteId) throw new Error("Website ID is required");
    const params: any = { /* ... construct params ... */ };
    return (await apiClient.get<Alert[]>(`/alerts/website/${websiteId}`, { params })) ?? []; // Ensure array return
};

/**
 * Fetches alert statistics for the authenticated user.
 * Endpoint: GET /alerts/user/stats
 */
export const fetchAlertStats = async (days: number = 7): Promise<AlertStats> => {
    // ... (implementation remains the same)
    const stats = await apiClient.get<AlertStats>("/alerts/user/stats", { params: { days } });
    // Provide default structure if API returns null/undefined unexpectedly
    return stats ?? { totalAlerts: 0, resolvedAlerts: 0, unresolvedAlerts: 0, byType: {}, byWebsite: [] };
};

/**
 * Marks a specific alert as read for the authenticated user.
 * Endpoint: POST /alerts/user/read/:alertId
 */
export const markAlertAsRead = async (alertId: number): Promise<void> => {
     if (!alertId || isNaN(alertId)) throw new Error("Valid Alert ID is required.");
    await apiClient.post<void>(`/alerts/user/read/${alertId}`);
};

/**
 * Marks all unread alerts as read for the authenticated user.
 * Endpoint: POST /alerts/user/read-all
 */
export const markAllAlertsAsRead = async (): Promise<void> => {
    await apiClient.post<void>("/alerts/user/read-all");
};

// NEW: Dismiss (delete) an alert for the authenticated user.
/**
 * Deletes the AlertUser link for a specific alert for the authenticated user.
 * Endpoint: DELETE /alerts/user/:alertId
 */
export const deleteAlertForUser = async (alertId: number): Promise<void> => {
    if (!alertId || isNaN(alertId)) throw new Error("Valid Alert ID is required.");
    await apiClient.delete<void>(`/alerts/user/${alertId}`);
};