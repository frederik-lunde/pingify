import apiClient from './client';
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    SetPinStatusDTO,
    Website,
} from '../types';

/**
 * Fetches all websites associated with the current user.
 */
export const fetchUserWebsites = async (): Promise<WebsiteUser[]> => {
    return apiClient.get<WebsiteUser[]>('/websites/user/dashboard');
};

/**
 * Fetches a single website by its ID for the current user.
 */
export const fetchUserWebsite = async (websiteId: number): Promise<WebsiteUser> => {
     if (!websiteId) throw new Error("Website ID is required to fetch a single website.");
    return apiClient.get<WebsiteUser>(`/websites/user/dashboard/${websiteId}`);
};

/**
 * Searches for websites based on a query string.
 */
export const searchWebsites = async (query: string, limit: number = 10): Promise<Website[]> => {
    return apiClient.get<Website[]>('/websites/search', { params: { query, limit } });
};

/**
 * Creates a new website for the current user.
 */
export const createWebsite = async (websiteData: AddWebsiteUserDTO): Promise<WebsiteUser> => {
    return apiClient.post<WebsiteUser>('/websites/user/dashboard', websiteData);
};

/**
 * Updates an existing website for the current user.
 */
export const updateWebsite = async ({ websiteId, websiteData }: { websiteId: number, websiteData: UpdateWebsiteUserDTO }): Promise<WebsiteUser> => {
     if (!websiteId) throw new Error("Website ID is required for update.");
    return apiClient.put<WebsiteUser>(`/websites/user/dashboard/${websiteId}`, websiteData);
};

/**
 * Sets the pin status of a website for the current user.
 */
export const setWebsitePinStatus = async ({ websiteId, pinData }: { websiteId: number, pinData: SetPinStatusDTO }): Promise<WebsiteUser> => {
    if (!websiteId) throw new Error("Website ID is required to set pin status.");
    return apiClient.patch<WebsiteUser>(`/websites/user/dashboard/${websiteId}/pin`, pinData);
};

/**
 * Deletes a website for the current user.
 */
export const deleteWebsite = async (websiteId: number): Promise<void> => {
     if (!websiteId) throw new Error("Website ID is required for deletion.");
    await apiClient.delete<unknown>(`/websites/user/dashboard/${websiteId}`);
};