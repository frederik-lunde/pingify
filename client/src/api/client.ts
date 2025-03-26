// // client/src/api/client.ts
// import axios from 'axios';
// import { API_BASE_URL } from './config';
// import { getAuthToken, fireAuthErrorEvent } from '../utils/authTokenUtils';

// // Create a reusable axios instance with default configuration
// const apiClient = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Add request interceptor for authentication
// apiClient.interceptors.request.use(
//   (config) => {
//     // Get auth token using the centralized utility
//     const token = getAuthToken();
//     if (token) {
//       config.headers['Authorization'] = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// // Add response interceptor for error handling
// apiClient.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     // Handle common errors (401, 403, etc.)
//     if (error.response && error.response.status === 401) {
//       // Trigger auth error event for AuthContext to handle
//       fireAuthErrorEvent();
//     }
//     return Promise.reject(error);
//   }
// );

// export default apiClient;