// src/api/monitoring.ts
import apiClient from './client';
import { MonitoringResult, WebsiteStats, OverallStats } from '../types';

/**
 * Get monitoring results for all user's websites
 */
export const getUserResults = async (
  limit = 100, 
  from?: Date, 
  to?: Date
): Promise<MonitoringResult[]> => {
  const params: any = { limit };
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  
  const response = await apiClient.get('/monitoring/user/results', { params });
  return response.data;
};

/**
 * Get monitoring results for a specific website
 */
export const getResultsByWebsite = async (
  websiteId: number, 
  limit = 100, 
  from?: Date, 
  to?: Date
): Promise<MonitoringResult[]> => {
  const params: any = { limit };
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();
  
  const response = await apiClient.get(`/monitoring/website/${websiteId}/results`, { params });
  return response.data;
};

/**
 * Get stats for user's dashboard (all websites)
 */
export const getUserStats = async (period = '7d'): Promise<OverallStats> => {
  const response = await apiClient.get('/monitoring/user/stats', {
    params: { period }
  });
  return response.data;
};

/**
 * Get stats for a specific website
 */
export const getWebsiteStats = async (
  websiteId: number, 
  period = '7d'
): Promise<WebsiteStats> => {
  const response = await apiClient.get(`/monitoring/website/${websiteId}/stats`, {
    params: { period }
  });
  return response.data;
};

/**
 * Trigger an immediate check for a website
 */
export const triggerWebsiteCheck = async (websiteId: number): Promise<{ message: string }> => {
  const response = await apiClient.post(`/monitoring/check/${websiteId}`);
  return response.data;
};

/**
 * Get monitoring results for a specific website (alternative to getResultsByWebsite)
 * Note: This accesses the API through the websites routes
 */
export const getWebsiteResults = async (websiteId: number, limit = 100): Promise<MonitoringResult[]> => {
  const response = await apiClient.get(`/websites/${websiteId}/results`, {
    params: { limit }
  });
  return response.data;
};