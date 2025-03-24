// src/api/websites.ts
import apiClient from './client';
import { UserWebsite, WebsiteCreateDTO, WebsiteUpdateDTO, Website } from '../types';

/**
 * Get all websites in the user's dashboard
 */
export const getUserWebsites = async (): Promise<UserWebsite[]> => {
  const response = await apiClient.get('/websites/user/dashboard');
  return response.data;
};

/**
 * Get a single website from the user's dashboard by ID
 */
export const getUserWebsiteById = async (websiteId: number): Promise<UserWebsite> => {
  const response = await apiClient.get(`/websites/user/dashboard/${websiteId}`);
  return response.data;
};

/**
 * Search for websites by URL
 * If query is empty, returns most recently added websites
 */
export const searchWebsites = async (query: string, limit = 10): Promise<Website[]> => {
  try {
    const response = await apiClient.get('/websites/search', {
      params: { query, limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching websites:', error);
    return []; // Return empty array on error instead of propagating the error
  }
};

/**
 * Add a website to the user's dashboard
 */
export const addWebsiteToUser = async (websiteData: WebsiteCreateDTO): Promise<UserWebsite> => {
  const response = await apiClient.post('/websites/user/dashboard', websiteData);
  return response.data;
};

/**
 * Update a website in the user's dashboard
 */
export const updateUserWebsite = async (
  websiteId: number, 
  websiteData: WebsiteUpdateDTO
): Promise<UserWebsite> => {
  const response = await apiClient.put(`/websites/user/dashboard/${websiteId}`, websiteData);
  return response.data;
};

/**
 * Remove a website from the user's dashboard
 */
export const removeWebsiteFromUser = async (websiteId: number): Promise<void> => {
  await apiClient.delete(`/websites/user/dashboard/${websiteId}`);
};

/**
 * Get monitoring results for a website
 */
export const getWebsiteResults = async (
  websiteId: number, 
  limit = 100
): Promise<any[]> => {
  const response = await apiClient.get(`/websites/${websiteId}/results`, {
    params: { limit }
  });
  return response.data;
};