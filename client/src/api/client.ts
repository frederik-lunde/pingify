// src/api/client.ts
import axios from 'axios';
import { API_BASE_URL } from './config';

// Create a reusable axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if needed
apiClient.interceptors.request.use(
  (config) => {
    // Example: Add auth token from localStorage
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors (401, 403, etc.)
    if (error.response) {
      if (error.response.status === 401) {
        // Unauthorized - redirect to login
        console.error('Authentication required');
        // Example: window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;