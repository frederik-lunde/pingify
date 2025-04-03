// src/api/websitesApi.ts
// No changes needed in API functions themselves.
import apiClient from './client';
import { UserWebsite, WebsiteCreateDTO, WebsiteUpdateDTO, Website } from '../types'; // Adjust path, add ApiError

/**
 * Fetches all websites for the user's dashboard.
 * Endpoint: GET /websites/user/dashboard
 */
export const fetchUserWebsites = async (): Promise<UserWebsite[]> => {
    return apiClient.get<UserWebsite[]>('/websites/user/dashboard');
};

/**
 * Fetches a single website by ID for the user's dashboard.
 * Endpoint: GET /websites/user/dashboard/:websiteId
 */
export const fetchUserWebsite = async (websiteId: number): Promise<UserWebsite> => {
     if (!websiteId) throw new Error("Website ID is required to fetch a single website.");
    return apiClient.get<UserWebsite>(`/websites/user/dashboard/${websiteId}`);
};

/**
 * Searches for websites globally (potential admin feature or public search).
 * Endpoint: GET /websites/search
 */
export const searchWebsites = async (query: string, limit: number = 10): Promise<Website[]> => {
    return apiClient.get<Website[]>('/websites/search', { params: { query, limit } });
};

/**
 * Creates a new website entry for the user.
 * Endpoint: POST /websites/user/dashboard
 */
export const createWebsite = async (websiteData: WebsiteCreateDTO): Promise<UserWebsite> => {
    return apiClient.post<UserWebsite>('/websites/user/dashboard', websiteData);
};

/**
 * Updates an existing website entry for the user.
 * Endpoint: PUT /websites/user/dashboard/:websiteId
 */
export const updateWebsite = async ({ websiteId, websiteData }: { websiteId: number, websiteData: WebsiteUpdateDTO }): Promise<UserWebsite> => {
     if (!websiteId) throw new Error("Website ID is required for update.");
    return apiClient.put<UserWebsite>(`/websites/user/dashboard/${websiteId}`, websiteData);
};

/**
 * Deletes a website entry for the user.
 * Endpoint: DELETE /websites/user/dashboard/:websiteId
 */
export const deleteWebsite = async (websiteId: number): Promise<void> => {
     if (!websiteId) throw new Error("Website ID is required for deletion.");
    await apiClient.delete<void>(`/websites/user/dashboard/${websiteId}`);
};