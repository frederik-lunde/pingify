// src/api/authApi.ts
// No changes needed based on the request, TanStack Query integration happens in hooks.
import apiClient from './client';
import { User } from '../types'; // Adjust path as needed

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean; // Add rememberMe here to pass to loginUser if needed
}

export interface RegistrationData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Logs in a user.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    // Destructure rememberMe out if the backend doesn't expect it in the payload
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rememberMe, ...loginPayload } = credentials;
    return apiClient.post<AuthResponse>('/auth/login', loginPayload);
};

/**
 * Registers a new user.
 */
export const registerUser = async (data: RegistrationData): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/auth/register', data);
};

/**
 * Fetches the currently authenticated user's data.
 */
export const fetchCurrentUser = async (): Promise<{ user: User }> => {
    // Ensure this matches your backend response structure
    return apiClient.get<{ user: User }>('/auth/me');
};