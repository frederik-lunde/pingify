// src/api/authApi.ts
import apiClient from './client';
import { User } from '../types'; 

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean; 
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
    return apiClient.get<{ user: User }>('/auth/me');
};