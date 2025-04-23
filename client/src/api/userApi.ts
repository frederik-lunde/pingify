// src/api/userApi.ts
import apiClient from './client';
import { User } from '../types'; // Assuming User type is defined here

// Interfaces matching backend service/controller expectations
export interface UpdateUserDataPayload {
    name?: string;
    email?: string;
}

export interface UpdatePasswordPayload {
    currentPassword?: string;
    newPassword?: string;
}

export interface UpdateUserResponse {
    user: Omit<User, 'password'>; // Return updated user data
    message: string;
}

/**
 * Updates the current user's profile information (name, email).
 */
export const updateUserProfileApi = async (data: UpdateUserDataPayload): Promise<UpdateUserResponse> => {
    return apiClient.patch<UpdateUserResponse>('/users/me', data);
};

/**
 * Updates the current user's password.
 */
export const updateUserPasswordApi = async (data: UpdatePasswordPayload): Promise<{ message: string }> => {
    // Ensure required fields are present before sending
     if (!data.currentPassword || !data.newPassword) {
         return Promise.reject(new Error("Current and new passwords are required."));
     }
    return apiClient.patch<{ message: string }>('/users/me/password', data);
};

/**
 * Deletes the current user's account.
 * Returns void on success (HTTP 204 No Content).
 */
export const deleteUserAccountApi = async (): Promise<void> => {
    await apiClient.delete('/users/me');
    // No explicit return needed for 204, but signifies success
};

// Optional: If you need to re-fetch the user profile separately
// export const fetchMyProfile = async (): Promise<{ user: Omit<User, 'password'> }> => {
//     return apiClient.get<{ user: Omit<User, 'password'> }>('/users/me');
// };