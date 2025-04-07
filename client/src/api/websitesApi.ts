// src/api/websitesApi.ts
import apiClient from './client';
import {
    WebsiteUser,
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    SetPinStatusDTO, // <-- Import DTO
    Website
} from '../types'; // Adjust path, add ApiError

/**
 * Fetches all websites for the user's dashboard.
 * Endpoint: GET /websites/user/dashboard
 * Note: Backend sorts this by isPinned desc, url asc
 */
export const fetchUserWebsites = async (): Promise<WebsiteUser[]> => {
    return apiClient.get<WebsiteUser[]>('/websites/user/dashboard');
};

/**
 * Fetches a single website by ID for the user's dashboard.
 * Endpoint: GET /websites/user/dashboard/:websiteId
 */
export const fetchUserWebsite = async (websiteId: number): Promise<WebsiteUser> => {
     if (!websiteId) throw new Error("Website ID is required to fetch a single website.");
    return apiClient.get<WebsiteUser>(`/websites/user/dashboard/${websiteId}`);
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
export const createWebsite = async (websiteData: AddWebsiteUserDTO): Promise<WebsiteUser> => {
    return apiClient.post<WebsiteUser>('/websites/user/dashboard', websiteData);
};

/**
 * Updates an existing website entry for the user.
 * Endpoint: PUT /websites/user/dashboard/:websiteId
 */
export const updateWebsite = async ({ websiteId, websiteData }: { websiteId: number, websiteData: UpdateWebsiteUserDTO }): Promise<WebsiteUser> => {
     if (!websiteId) throw new Error("Website ID is required for update.");
    return apiClient.put<WebsiteUser>(`/websites/user/dashboard/${websiteId}`, websiteData);
};

/**
 * Sets the pin status for a user's website.
 * Endpoint: PATCH /websites/user/dashboard/:websiteId/pin
 */
export const setWebsitePinStatus = async ({ websiteId, pinData }: { websiteId: number, pinData: SetPinStatusDTO }): Promise<WebsiteUser> => {
    if (!websiteId) throw new Error("Website ID is required to set pin status.");
    return apiClient.patch<WebsiteUser>(`/websites/user/dashboard/${websiteId}/pin`, pinData);
};


/**
 * Deletes a website entry for the user.
 * Endpoint: DELETE /websites/user/dashboard/:websiteId
 */
export const deleteWebsite = async (websiteId: number): Promise<void> => {
     if (!websiteId) throw new Error("Website ID is required for deletion.");
    // Ensure the response is handled correctly (might be 204 No Content)
    await apiClient.delete<any>(`/websites/user/dashboard/${websiteId}`);
};