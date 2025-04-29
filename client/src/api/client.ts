// src/api/client.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from "axios";
import { API_BASE_URL } from "../config/config"; // Assuming this is correctly exported from your config
import { getAuthToken, fireAuthErrorEvent } from "../utils/authTokenUtils";
// Import ApiError from the central types file
import { ApiError } from "../types";

// --- ApiClient Class ---
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      timeout: 20000, // Example timeout
    });

    // --- Request Interceptor ---
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = getAuthToken();
        if (token && config.headers) {
          // Ensure headers object exists before assigning
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        // Handle request setup errors (less common)
        console.error("Axios Request Setup Error:", error);
        return Promise.reject(error); // Reject with the original Axios error
      },
    );

    // --- Response Interceptor ---
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response, // Pass successful responses through
      (error: AxiosError) => { // Handle errors
        const { response, config, code, message: axiosMessage } = error;

        // --- Handle 401 Unauthorized (except for login/register endpoints) ---
        if (response?.status === 401) {
          const endpoint = config?.url ?? '';
          // Check if the request was NOT for login or register
          const isLoginOrRegister = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
          if (!isLoginOrRegister) {
            console.warn(`Authentication Error (401) on ${endpoint}. Signaling global handler.`);
            fireAuthErrorEvent(); // Trigger global auth error handling
          }
          // Note: We still proceed to create an ApiError for 401s on login/register
          // so the calling hook (useLoginMutation) can handle the specific error.
        }

        // --- Determine User-Friendly Error Message ---
        let userMessage = "An unexpected error occurred. Please try again later.";
        if (code === 'ECONNABORTED') {
          userMessage = "The request timed out. Please check your connection and try again.";
        } else if (!response) {
           // No response received (network error, CORS issue before request completion, etc.)
           userMessage = "Network error. Unable to reach the server. Please check your internet connection.";
        } else if (response.data) {
           // Try to extract message from response body
           const responseData = response.data; // Type is unknown here
           if (typeof responseData === "object" && responseData !== null) {
                // Check for nested { error: { message: '...' } } structure
                if ('error' in responseData && typeof responseData.error === 'object' && responseData.error !== null && 'message' in responseData.error && typeof responseData.error.message === 'string') {
                     userMessage = responseData.error.message;
                }
                // Check for top-level { message: '...' } structure
                else if ('message' in responseData && typeof responseData.message === 'string') {
                     userMessage = responseData.message;
                }
           } else if (typeof responseData === "string" && responseData.length > 0) {
               // Handle plain string error responses
               userMessage = responseData;
           }
           // Add more checks here if your API returns errors in other formats
        } else if (axiosMessage) {
            // Fallback to Axios's own error message if no better one found
            userMessage = axiosMessage;
        }

        // --- Create Standardized ApiError ---
        // Use the imported ApiError interface structure
        const apiError: ApiError = new Error(userMessage) as ApiError; // Cast needed as we add properties
        apiError.name = 'ApiError'; // Identify the error type
        apiError.status = response?.status;
        apiError.statusText = response?.statusText;
        apiError.url = config?.url;
        apiError.method = config?.method?.toUpperCase();
        apiError.data = response?.data; // Assign raw response data (can be any type)
        apiError.isAuthError = response?.status === 401;
        // More robust network error check
        apiError.isNetworkError = !response && (axiosMessage === 'Network Error' || code === 'ECONNABORTED' || code === 'ERR_NETWORK');

        // --- Log the Detailed Error ---
        // Use warn for expected auth failures on login/register, error otherwise
        const logMethod = (apiError.isAuthError && (apiError.url?.includes('/auth/login') || apiError.url?.includes('/auth/register')))
            ? console.warn
            : console.error;

        logMethod(
            `API Error: ${apiError.status ?? (apiError.isNetworkError ? 'Network' : 'Unknown')} on ${apiError.method || 'N/A'} ${apiError.url || 'N/A'}`,
            `\n  Message: ${apiError.message}`,
             // Only stringify data if it's an object/array and not empty
             (apiError.data && typeof apiError.data !== 'string' && Object.keys(apiError.data).length > 0) ? `\n  Data: ${JSON.stringify(apiError.data)}` : ''
        );

        // --- Reject the Promise with the Standardized ApiError ---
        return Promise.reject(apiError);
      },
    );
  }

  // --- HTTP Method Wrappers ---

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  // Use 'unknown' as default for request body type D
  async post<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

   // Use 'unknown' as default for request body type D
   async put<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  // Use 'unknown' as default for request body type D
  async patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  // Delete method typically doesn't have a request body, so no 'D' needed
  // T represents the expected response body type (often void or a confirmation message)
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

// --- Singleton Instance ---
const apiClient = new ApiClient();
export default apiClient;