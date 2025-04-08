// src/api/client.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from "axios";
import { API_BASE_URL } from "../config/config";
import { getAuthToken, fireAuthErrorEvent } from "../utils/authTokenUtils";

// --- ApiError Interface ---
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

// --- ApiClient Class ---
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL, // Uses the config value
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      timeout: 20000,
    });

    // --- Request Interceptor ---
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = getAuthToken();
        if (token && config.headers) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        console.error("Axios Request Setup Error:", error);
        return Promise.reject(error);
      },
    );

    // --- Response Interceptor ---
     this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        const { response, config, code, message: axiosMessage } = error;

        if (response?.status === 401) {
          const endpoint = config?.url ?? '';
          const isLoginOrRegister = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
          if (!isLoginOrRegister) {
            console.warn(`Authentication Error (401) on ${endpoint}. Signaling global handler.`);
            fireAuthErrorEvent();
          }
        }

        let userMessage = "An unexpected error occurred. Please try again later.";
        if (code === 'ECONNABORTED') {
          userMessage = "The request timed out. Please check your connection and try again.";
        } else if (!response) {
           userMessage = "Network error. Unable to reach the server. Please check your internet connection.";
        } else if (response.data) {
           const responseData = response.data as any;
           if (typeof responseData === "object" && responseData !== null && responseData.error?.message) {
               userMessage = responseData.error.message;
           } else if (typeof responseData === "object" && responseData !== null && responseData.message) {
               userMessage = responseData.message;
           } else if (typeof responseData === "string" && responseData.length > 0) {
               userMessage = responseData;
           }
        } else if (axiosMessage) {
            userMessage = axiosMessage;
        }

        const apiError: ApiError = new Error(userMessage);
        apiError.status = response?.status;
        apiError.statusText = response?.statusText;
        apiError.url = config?.url;
        apiError.method = config?.method?.toUpperCase();
        apiError.data = response?.data;
        apiError.isAuthError = response?.status === 401;
        apiError.isNetworkError = !response && axiosMessage === 'Network Error';

        const logMethod = (apiError.isAuthError && (config?.url?.includes('/auth/login') || config?.url?.includes('/auth/register')))
            ? console.warn
            : console.error;

        logMethod(
            `API Error: ${apiError.status ?? (apiError.isNetworkError ? 'Network' : 'Unknown')} on ${apiError.method || 'N/A'} ${apiError.url || 'N/A'}`,
            `\n  Message: ${apiError.message}`,
             (apiError.data && typeof apiError.data !== 'string') ? `\n  Data: ${JSON.stringify(apiError.data)}` : ''
        );

        return Promise.reject(apiError);
      },
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  async post<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

   async put<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

// --- Singleton Instance ---
const apiClient = new ApiClient();
export default apiClient;