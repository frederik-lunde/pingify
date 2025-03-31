// src/api/client.ts (or enhancedClient.ts)
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import { API_BASE_URL } from "./config";
import { getAuthToken, fireAuthErrorEvent } from "../utils/authTokenUtils";

/**
 * API response type with proper typing
 */
export type ApiResponse<T> = Promise<T>;

/**
 * Enhanced API client with stronger typing and better error handling
 */
class EnhancedApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        // Get auth token using the centralized utility
        const token = getAuthToken();
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle session expiration/auth errors
        if (error.response?.status === 401) {
          // Only fire auth error event for token-related issues
          // We don't want to log the user out for simple login failures
          const isLoginEndpoint = error.config?.url?.includes('/auth/login') || 
                                 error.config?.url?.includes('/auth/register');
          
          if (!isLoginEndpoint) {
            // Trigger auth error event for AuthContext to handle
            fireAuthErrorEvent();
          }
        }

        // Extract error message safely handling various response formats
        let errorMessage = "Unknown API error";

        if (error.message) {
          errorMessage = error.message;
        }

        // Check if response.data exists and has a message/error property
        if (error.response?.data) {
          const data = error.response.data as any;
          
          // Handle different error response formats
          if (typeof data === "object" && data !== null) {
            if (data.error?.message) {
              // Format: { error: { message: "..." } }
              errorMessage = data.error.message;
            } else if (data.message) {
              // Format: { message: "..." }
              errorMessage = data.message;
            } else if (data.error && typeof data.error === "string") {
              // Format: { error: "..." }
              errorMessage = data.error;
            }
          } else if (typeof data === "string") {
            // Handle case where the entire data is a string message
            errorMessage = data;
          }
        }

        // Customize error messages for user-friendly display
        if (error.response?.status === 401 && 
            errorMessage.includes("Invalid credentials")) {
          errorMessage = "Invalid email or password";
        }

        // Enhance error with additional information for better debugging
        const enhancedError = new Error(errorMessage);

        // Add additional context to the error
        Object.assign(enhancedError, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          data: error.response?.data,
          isAuthError: error.response?.status === 401,
          isNetworkError: error.message === 'Network Error'
        });

        return Promise.reject(enhancedError);
      },
    );
  }

  /**
   * Generic GET request
   * @param url - API endpoint
   * @param config - Axios request config
   * @returns Promise with the response data
   */
  async get<T>(url: string, config?: AxiosRequestConfig): ApiResponse<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   * @param url - API endpoint
   * @param data - Request payload
   * @param config - Axios request config
   * @returns Promise with the response data
   */
  async post<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): ApiResponse<T> {
    const response: AxiosResponse<T> = await this.client.post(
      url,
      data,
      config,
    );
    return response.data;
  }

  /**
   * Generic PUT request
   * @param url - API endpoint
   * @param data - Request payload
   * @param config - Axios request config
   * @returns Promise with the response data
   */
  async put<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): ApiResponse<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   * @param url - API endpoint
   * @param config - Axios request config
   * @returns Promise with the response data
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): ApiResponse<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

// Create a singleton instance
const apiClient = new EnhancedApiClient();
export default apiClient;