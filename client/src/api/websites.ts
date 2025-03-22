// src/api/websites.ts
import apiClient from './client';
import { Website } from '../types';

/**
 * Get all websites
 */
export const getWebsites = async (): Promise<Website[]> => {
  const response = await apiClient.get('websites/user/dashboard');
  return response.data;
};

/**
 * Get a single website by ID
 */
export const getWebsiteById = async (websiteId: number): Promise<Website> => {
  const response = await apiClient.get(`/websites/${websiteId}`);
  return response.data;
};

/**
 * Create a new website to monitor
 */
export const createWebsite = async (websiteData: Partial<Website>): Promise<Website> => {
  const response = await apiClient.post('websites/user/dashboard', websiteData);
  return response.data;
};

/**
 * Update a website
 * Not used yet
 */
export const updateWebsite = async (websiteId: number, websiteData: Partial<Website>): Promise<Website> => {
  const response = await apiClient.put(`/websites/${websiteId}`, websiteData);
  return response.data;
};

/**
 * Delete a website
 * not used yet
 */
export const deleteWebsite = async (websiteId: number): Promise<void> => {
  await apiClient.delete(`/websites/${websiteId}`);
};