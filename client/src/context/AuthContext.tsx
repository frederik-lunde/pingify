// client/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { API_BASE_URL } from '../api/config';
import { getAuthToken, storeAuthToken, removeAuthToken } from '../utils/authTokenUtils';
import { User, AuthContextType } from '../types';


const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        const response = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUser(response.data.user);
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

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const { token: authToken, user: userData } = response.data;
      
      storeAuthToken(authToken, rememberMe);
      setToken(authToken);
      setUser(userData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/auth/register`, { email, password, name });
      const { token: authToken, user: userData } = response.data;
      
      // For registration, we'll use sessionStorage by default (no "remember me" on registration)
      storeAuthToken(authToken, false);
      setToken(authToken);
      setUser(userData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};