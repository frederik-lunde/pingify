import apiClient from './client';
import {
    OverallStats,
    WebsiteStatsData,
    TimeframeKey,
    WebsiteDetailsData,
    MonitoringResult,
} from '../types';

/**
 * Parameters for fetching website details.
 */
export interface FetchWebsiteDetailsParams {
    websiteId: number;
    timeframe?: TimeframeKey;
    limit?: number;
    incidentLimit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
}

/**
 * Fetches detailed information for a specific website.
 */
export const fetchWebsiteDetails = async ({
    websiteId,
    timeframe = 'day',
    limit = 10,
    incidentLimit = 10,
    sortBy = 'checkedAt',
    sortDir = 'desc'
}: FetchWebsiteDetailsParams): Promise<WebsiteDetailsData> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching details.");
    }
    return apiClient.get<WebsiteDetailsData>(`/monitoring/website/${websiteId}`, {
        params: { timeframe, limit, incidentLimit, sortBy, sortDir }
    });
};

/**
 * Fetches overall monitoring statistics for the user.
 */
export const fetchUserStats = async (period: TimeframeKey | string = 'week'): Promise<OverallStats> => {
    return apiClient.get<OverallStats>("/monitoring/user/stats", { params: { period } });
};

/**
 * Fetches monitoring statistics for a specific website.
 */
export const fetchWebsiteStats = async (websiteId: number, period: TimeframeKey | string = 'week'): Promise<WebsiteStatsData> => {
     if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
       throw new Error("Invalid website ID provided for fetching stats.");
    }
    return apiClient.get<WebsiteStatsData>(`/monitoring/website/${websiteId}/stats`, { params: { period } });
};

/**
 * Triggers an on-demand check for a specific website.
 */
export const triggerWebsiteCheck = async (websiteId: number): Promise<MonitoringResult> => {
    if (!websiteId || isNaN(websiteId) || websiteId <= 0) {
      throw new Error("Invalid website ID provided for triggering check.");
   }
   return apiClient.post<MonitoringResult>(`/monitoring/check/${websiteId}`);
};

/**
 * Fetches all monitoring results for the current user.
 */
export const fetchAllUserMonitoringResults = async (limit: number = 500): Promise<MonitoringResult[]> => {
    const result = await apiClient.get<MonitoringResult[]>("/monitoring/user/results", { params: { limit } });
    return result ?? [];
};