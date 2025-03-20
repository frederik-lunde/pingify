import apiClient from "./client";

/**
 * Register a new user
 */
export const register = async (userData: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user: { id: number; email: string; name: string }; token: string }> => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

/**
 * Login a user
 */

export const login = async (credentials: { email: string; password: string }): Promise<{ user: { id: number; email: string; name: string }; token: string }> => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

/**
 * Get the current user
 */

export const getCurrentUser = async (): Promise<{ id: number; email: string; name: string }> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

