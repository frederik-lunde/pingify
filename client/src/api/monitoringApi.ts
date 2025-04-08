// src/api/monitoringApi.ts
// No changes needed in this file.
import apiClient from './client';
import { OverallStats, WebsiteStatsData, TimeframeKey, WebsiteDetailsData, MonitoringResult } from '../types'; // Adjust path as needed, added ApiError

export interface FetchWebsiteDetailsParams {
    websiteId: number;
    timeframe?: TimeframeKey;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
}

/**
 * Fetches detailed data for a specific website view.
 * Endpoint: GET /monitoring/website/:websiteId
 */
export const fetchWebsiteDetails = async ({
    websiteId,
    timeframe = 'day', // Default timeframe
    limit = 10,        // Default limit for recent checks
    sortBy = 'timestamp', // Default sort
    sortDir = 'desc'     // Default direction
}: FetchWebsiteDetailsParams): Promise<WebsiteDetailsData> => {
    // Validate websiteId before making the call
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching details.");
    }
    return apiClient.get<WebsiteDetailsData>(`/monitoring/website/${websiteId}`, {
        params: { timeframe, limit, sortBy, sortDir }
    });
};

/**
 * Fetches statistics for the current user's dashboard.
 * Endpoint: GET /monitoring/user/stats
 */
export const fetchUserStats = async (period: TimeframeKey | string = 'week'): Promise<OverallStats> => {
    // The response type OverallStats now includes incidentsLast24h
    return apiClient.get<OverallStats>("/monitoring/user/stats", { params: { period } });
};

/**
 * Fetches statistics for a specific website.
 * Endpoint: GET /monitoring/website/:websiteId/stats
 */
export const fetchWebsiteStats = async (websiteId: number, period: TimeframeKey | string = 'week'): Promise<WebsiteStatsData> => {
     if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching stats.");
    }
    return apiClient.get<WebsiteStatsData>(`/monitoring/website/${websiteId}/stats`, { params: { period } });
};

/**
 * Triggers an immediate check for a website.
 * Endpoint: POST /monitoring/check/:websiteId
 */
export const triggerWebsiteCheck = async (websiteId: number): Promise<MonitoringResult> => { // <--- FIX: Changed return type here
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
      throw new Error("Invalid website ID provided for triggering check.");
   }
   // Backend controller returns the full SharedMonitoringResult object
   return apiClient.post<MonitoringResult>(`/monitoring/check/${websiteId}`); // <-- FIX: Changed expected response type
};

/**
 * Fetches all monitoring results for the current user (potential performance concern).
 * Endpoint: GET /monitoring/user/results
 * Consider adding filters (timeframe, website IDs) if the endpoint supports them.
 */
export const fetchAllUserMonitoringResults = async (limit: number = 500): Promise<MonitoringResult[]> => {
    // Warning: Fetching potentially large amounts of data.
    // Check if your backend supports pagination or filtering for this endpoint.
    const result = await apiClient.get<MonitoringResult[]>("/monitoring/user/results", { params: { limit } });
    return result ?? []; // Ensure array
};