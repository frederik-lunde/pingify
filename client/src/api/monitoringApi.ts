// src/api/monitoringApi.ts
import apiClient from './client';
import {
    OverallStats,
    WebsiteStatsData,
    TimeframeKey,
    WebsiteDetailsData,
    MonitoringResult,
} from '../types';

export interface FetchWebsiteDetailsParams {
    websiteId: number;
    timeframe?: TimeframeKey;
    limit?: number; // Limit for recent checks
    incidentLimit?: number; // Limit for recent incidents
    sortBy?: string; // Sort key for recent checks
    sortDir?: 'asc' | 'desc'; // Sort direction for recent checks
}

/**
 * Fetches detailed data for a specific website view.
 * Endpoint: GET /monitoring/website/:websiteId
 * UPDATED: Backend now includes currentIncident and recentIncidents.
 */
export const fetchWebsiteDetails = async ({
    websiteId,
    timeframe = 'day',
    limit = 10, // Default limit for recent checks
    incidentLimit = 10, // Default limit for recent incidents
    sortBy = 'checkedAt', // Default sort for recent checks
    sortDir = 'desc'
}: FetchWebsiteDetailsParams): Promise<WebsiteDetailsData> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching details.");
    }
    // Pass incidentLimit to the backend
    return apiClient.get<WebsiteDetailsData>(`/monitoring/website/${websiteId}`, {
        params: { timeframe, limit, incidentLimit, sortBy, sortDir }
    });
};

/**
 * Fetches statistics for the current user's dashboard.
 * Endpoint: GET /monitoring/user/stats
 * UPDATED: Backend now uses Incident table for incident stats.
 */
export const fetchUserStats = async (period: TimeframeKey | string = 'week'): Promise<OverallStats> => {
    return apiClient.get<OverallStats>("/monitoring/user/stats", { params: { period } });
};


// --- REMOVED: fetchDownWebsitesLast24h ---
// This information is now derived from incidents.

/**
 * Fetches statistics for a specific website.
 * Endpoint: GET /monitoring/website/:websiteId/stats
 * UPDATED: Backend now includes incident counts in the response.
 */
export const fetchWebsiteStats = async (websiteId: number, period: TimeframeKey | string = 'week'): Promise<WebsiteStatsData> => {
     if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching stats.");
    }
    // The response type WebsiteStatsData now includes incident counts
    return apiClient.get<WebsiteStatsData>(`/monitoring/website/${websiteId}/stats`, { params: { period } });
};

/**
 * Triggers an immediate check for a website.
 * Endpoint: POST /monitoring/check/:websiteId
 * NOTE: Backend handles incident creation/resolution based on this check.
 */
export const triggerWebsiteCheck = async (websiteId: number): Promise<MonitoringResult> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
      throw new Error("Invalid website ID provided for triggering check.");
   }
   return apiClient.post<MonitoringResult>(`/monitoring/check/${websiteId}`);
};

/**
 * Fetches all monitoring results for the current user
 * Endpoint: GET /monitoring/user/results
 */
export const fetchAllUserMonitoringResults = async (limit: number = 500): Promise<MonitoringResult[]> => {
    const result = await apiClient.get<MonitoringResult[]>("/monitoring/user/results", { params: { limit } });
    return result ?? [];
};

// --- REMOVED: fetchUserIncidentCountLast24h ---
// Moved to incidentApi.ts