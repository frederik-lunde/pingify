import apiClient from './client';
import { User } from '../types';

/**
 * Payload for updating user data.
 */
export interface UpdateUserDataPayload {
    name?: string;
    email?: string;
}

/**
 * Payload for updating user password.
 */
export interface UpdatePasswordPayload {
    currentPassword?: string;
    newPassword?: string;
}

/**
 * Response structure for updating user profile.
 */
export interface UpdateUserResponse {
    user: Omit<User, 'password'>;
    message: string;
}

/**
 * Updates the current user's profile information.
 */
export const updateUserProfileApi = async (data: UpdateUserDataPayload): Promise<UpdateUserResponse> => {
    return apiClient.patch<UpdateUserResponse>('/users/me', data);
};

/**
 * Updates the current user's password.
 */
export const updateUserPasswordApi = async (data: UpdatePasswordPayload): Promise<{ message: string }> => {
     if (!data.currentPassword || !data.newPassword) {
         return Promise.reject(new Error("Current and new passwords are required."));
     }
    return apiClient.patch<{ message: string }>('/users/me/password', data);
};

/**
 * Deletes the current user's account.
 */
export const deleteUserAccountApi = async (): Promise<void> => {
    await apiClient.delete('/users/me');
};