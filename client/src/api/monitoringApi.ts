
// src/api/monitoringApi.ts

import apiClient from './client';
import {
    OverallStats,
    WebsiteStatsData,
    TimeframeKey,
    WebsiteDetailsData,
    MonitoringResult,
    IncidentCountResponse
} from '../types';

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
    timeframe = 'day',
    limit = 10,
    sortBy = 'timestamp',
    sortDir = 'desc'
}: FetchWebsiteDetailsParams): Promise<WebsiteDetailsData> => {
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

/**
 * Fetches the count of distinct websites with incidents (based on MonitoringResults)
 * in the last 24 hours for the user.
 * Endpoint: GET /monitoring/user/incidents/last24h
 */
export const fetchUserIncidentCountLast24h = async (): Promise<IncidentCountResponse> => {
    const url = "/monitoring/user/incidents/last24h";
    try {
        const data = await apiClient.get<IncidentCountResponse>(url);
        return data ?? { incidentCount: 0 };
    } catch (error: any) {
        console.error(`API Error fetching monitoring-based incident count: ${error.message}`);
        throw error;
    }
};