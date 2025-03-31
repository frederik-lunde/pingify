// src/api/client.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig // Import for request interceptor type
} from "axios";
import { API_BASE_URL } from "./config"; // Adjust the path as needed
import { getAuthToken, fireAuthErrorEvent } from "../utils/authTokenUtils"; // Adjust the path as needed

/**
 * Custom Error type for API errors, extending the base Error object
 * with additional context from the API response.
 */
export interface ApiError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: any;
  isAuthError?: boolean;
  isNetworkError?: boolean;
}

/**
 * Enhanced API client using Axios with interceptors for authentication
 * and centralized error handling.
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json", // Good practice to include Accept header
      },
      timeout: 20000, // Set a reasonable request timeout (e.g., 20 seconds)
    });

    // --- Request Interceptor ---
    // Automatically attaches the Authorization header to outgoing requests.
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = getAuthToken(); // Fetch token using the utility
        if (token && config.headers) { // Ensure headers object exists
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        // Handle rare request setup errors
        console.error("Axios Request Setup Error:", error);
        return Promise.reject(error);
      },
    );

    // --- Response Interceptor ---
    // Handles successful responses and processes errors centrally.
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response, // Pass through successful responses directly
      (error: AxiosError) => {
        // --- Centralized Error Processing ---
        const { response, config, code, message: axiosMessage } = error;

        // 1. Handle 401 Unauthorized (Session Expired / Invalid Token) Globally
        if (response?.status === 401) {
          const endpoint = config?.url ?? '';
          // Avoid global logout for direct login/register attempts that fail authentication
          const isLoginOrRegister = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');

          if (!isLoginOrRegister) {
            // This is likely an expired/invalid token on a protected route
            console.warn(`Authentication Error (401) on ${endpoint}. Signaling global handler.`);
            // Signal the AuthContext (via useAuth listener) to handle logout/redirect
            fireAuthErrorEvent();
          }
          // Note: We don't clear tokens here; the event listener in useAuth handles that.
        }

        // 2. Determine the User-Facing Error Message (Trusting Backend Middleware)
        let userMessage = "An unexpected error occurred. Please try again later."; // Sensible default
        

        if (code === 'ECONNABORTED') {
          userMessage = "The request timed out. Please check your connection and try again.";
        } else if (!response) {
           // Network error (server unreachable, CORS issue, etc.)
           userMessage = "Network error. Unable to reach the server. Please check your internet connection.";
        } else if (response.data) {
           // Attempt to extract message from backend response structure { error: { message: ... } }
           const responseData = response.data as any; // Use 'any' for flexible checking
           if (typeof responseData === "object" && responseData !== null && responseData.error?.message) {
               userMessage = responseData.error.message;
           }
           // Fallback: Check for { message: ... } structure
           else if (typeof responseData === "object" && responseData !== null && responseData.message) {
               userMessage = responseData.message;
           }
           // Fallback: If the entire response data is a string
           else if (typeof responseData === "string" && responseData.length > 0) {
               userMessage = responseData;
           }
           // Add more checks here if your backend has other error formats
        } else if (axiosMessage) {
            // Fallback to the generic Axios error message if no specific message found
            userMessage = axiosMessage;
        }

        // 3. Construct the Structured ApiError Object
        const apiError: ApiError = new Error(userMessage);
        apiError.status = response?.status;
        apiError.statusText = response?.statusText;
        apiError.url = config?.url;
        apiError.method = config?.method?.toUpperCase();
        apiError.data = response?.data;
        apiError.isAuthError = response?.status === 401;
        apiError.isNetworkError = !response && axiosMessage === 'Network Error';

        // 4. Log the Processed Error for Debugging
        // Avoid logging expected 401s on login as "errors" if they are just bad credentials
        const logMethod = (apiError.isAuthError && (config?.url?.includes('/auth/login') || config?.url?.includes('/auth/register')))
            ? console.warn // Log failed login/register attempts as warnings
            : console.error; // Log other errors as errors

        logMethod(
            `API Error: ${apiError.status ?? (apiError.isNetworkError ? 'Network' : 'Unknown')} on ${apiError.method || 'N/A'} ${apiError.url || 'N/A'}`,
            `\n  Message: ${apiError.message}`,
            // Optionally log the raw data only if it's not a simple string or if needed
             (apiError.data && typeof apiError.data !== 'string') ? `\n  Data: ${JSON.stringify(apiError.data)}` : ''
        );


        // 5. Reject the Promise with the structured ApiError
        // This allows calling code (.catch blocks) to receive the processed error.
        return Promise.reject(apiError);
      },
    );
  }

  // --- Standard HTTP Method Wrappers ---
  // These provide a cleaner interface and automatically handle response data extraction.

  /** Generic GET request */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /** Generic POST request */
  async post<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /** Generic PUT request */
  async put<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /** Generic DELETE request */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

// --- Singleton Instance ---
// Create and export a single instance of the client for use throughout the application.
const apiClient = new ApiClient();
export default apiClient;