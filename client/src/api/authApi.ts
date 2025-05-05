// src/api/authApi.ts
import apiClient from './client';
import { User, LoginCredentials, AuthResponse, RegisterUserData } from '../types'; 


/**
 * Logs in a user.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const {...loginPayload } = credentials;
    return apiClient.post<AuthResponse>('/auth/login', loginPayload);
};

/**
 * Registers a new user.
 */
export const registerUser = async (data: RegisterUserData): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/auth/register', data);
};

/**
 * Fetches the currently authenticated user's data.
 */
export const fetchCurrentUser = async (): Promise<{ user: User }> => {
    return apiClient.get<{ user: User }>('/auth/me');
};