// client/src/api/client.ts
import axios from 'axios';
import { API_BASE_URL } from './config';

// Create a reusable axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


export default apiClient;