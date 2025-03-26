// src/hooks/api/useAuth.ts
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getAuthToken, storeAuthToken, removeAuthToken } from '../../utils/authTokenUtils';
import { User, AuthContextType } from '../../types';
import apiClient from '../../api/client';

/**
 * Interface for login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Interface for registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Hook for authentication operations
 */
export function useAuth(): AuthContextType {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Handle authentication errors
  useEffect(() => {
    const handleAuthError = () => {
      // Clear auth data
      removeAuthToken();
      setToken(null);
      setUser(null);
      
      // Redirect to login
      navigate('/login', { replace: true });
    };

    // Listen for custom auth error events
    window.addEventListener('auth-error', handleAuthError);
    
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, [navigate]);

  // Load user data if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await apiClient.get<{ user: User }>('/auth/me');
        setUser(userData.user);
        setError(null);
      } catch (err) {
        console.error('Failed to load user', err);
        removeAuthToken();
        setToken(null);
        setUser(null);
        setError('Session expired. Please login again.');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  /**
   * Login user with email and password
   */
  const login = useCallback(async (
    email: string, 
    password: string, 
    rememberMe: boolean = false
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.post<{ token: string; user: User }>(
        '/auth/login', 
        { email, password }
      );
      
      const { token: authToken, user: userData } = response;
      
      storeAuthToken(authToken, rememberMe);
      setToken(authToken);
      setUser(userData);
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Register a new user
   */
  const register = useCallback(async (
    email: string, 
    password: string, 
    name?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.post<{ token: string; user: User }>(
        '/auth/register', 
        { email, password, name }
      );
      
      const { token: authToken, user: userData } = response;
      
      // For registration, we'll use sessionStorage by default (no "remember me" on registration)
      storeAuthToken(authToken, false);
      setToken(authToken);
      setUser(userData);
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout the current user
   */
  const logout = useCallback(() => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  return { 
    user, 
    token, 
    loading, 
    error, 
    login, 
    register, 
    logout 
  };
}

export default useAuth;