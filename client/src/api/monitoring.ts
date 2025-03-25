// src/api/monitoring.ts
import apiClient from './client';
import { MonitoringResult, WebsiteStats, OverallStats } from '../types';

export type TimeRange = '1h' | '12h' | '24h' | '7d' | '30d' | '90d';

/**
 * Convert TimeRange to Date objects
 */
const getRangeDates = (range: TimeRange): { from: Date; to: Date } => {
  const to = new Date();
  const from = new Date(to);
  
  switch (range) {
    case '1h': from.setHours(to.getHours() - 1); break;
    case '12h': from.setHours(to.getHours() - 12); break;
    case '24h': from.setDate(to.getDate() - 1); break;
    case '7d': from.setDate(to.getDate() - 7); break;
    case '30d': from.setDate(to.getDate() - 30); break;
    case '90d': from.setDate(to.getDate() - 90); break;
    default: from.setDate(to.getDate() - 7); // Default to 7 days
  }
  
  return { from, to };
};

/**
 * Get monitoring results for all user's websites
 */
export const getUserResults = async (
  limit = 100,
  range?: TimeRange | { from?: Date; to?: Date }
): Promise<MonitoringResult[]> => {
  const params: { limit: number; from?: string; to?: string } = { limit };
  
  if (range) {
    if (typeof range === 'string') {
      const { from, to } = getRangeDates(range);
      params.from = from.toISOString();
      params.to = to.toISOString();
    } else {
      if (range.from) params.from = range.from.toISOString();
      if (range.to) params.to = range.to.toISOString();
    }
  }
  
  const response = await apiClient.get('/monitoring/user/results', { params });
  return response.data;
};

/**
 * Get monitoring results for a specific website
 */
export const getResultsByWebsite = async (
  websiteId: number,
  limit = 100,
  range?: TimeRange | { from?: Date; to?: Date }
): Promise<MonitoringResult[]> => {
  const params: { limit: number; from?: string; to?: string } = { limit };
  
  if (range) {
    if (typeof range === 'string') {
      const { from, to } = getRangeDates(range);
      params.from = from.toISOString();
      params.to = to.toISOString();
    } else {
      if (range.from) params.from = range.from.toISOString();
      if (range.to) params.to = range.to.toISOString();
    }
  }
  
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