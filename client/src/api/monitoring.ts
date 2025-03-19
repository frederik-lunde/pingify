// src/api/monitoring.ts
import apiClient from './client';
import { MonitoringResult, OverallStats } from '../types';

/**
 * Get the latest monitoring results
 */
export const getMonitoringResults = async (limit = 20): Promise<MonitoringResult[]> => {
  const response = await apiClient.get(`/monitoring/results?limit=${limit}`);
  return response.data;
};

/**
 * Get monitoring results for a specific website
 */
export const getWebsiteResults = async (websiteId: number, limit = 20): Promise<MonitoringResult[]> => {
  const response = await apiClient.get(`/monitoring/website/${websiteId}/results?limit=${limit}`);
  return response.data;
};

/**
 * Get overall monitoring statistics
 */
export const getMonitoringStats = async (): Promise<OverallStats> => {
  const response = await apiClient.get('/monitoring/stats');
  return response.data;
};

/**
 * Trigger a manual check for a website
 */
export const triggerWebsiteCheck = async (websiteId: number): Promise<any> => {
  const response = await apiClient.post(`/monitoring/check/${websiteId}`);
  return response.data;
};
