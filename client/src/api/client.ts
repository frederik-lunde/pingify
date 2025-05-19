import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from "axios";
import { API_BASE_URL } from "../config/config";
import { getAuthToken, fireAuthErrorEvent } from "../utils/authTokenUtils";
import { ApiError } from "../types";


class ApiClient {
  private client: AxiosInstance;

  /**
   * Initializes the Axios client with base URL, headers, timeout, and interceptors.
   */
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      timeout: 20000,
    });

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
           const responseData = response.data;
           if (typeof responseData === "object" && responseData !== null) {
                if ('error' in responseData && typeof responseData.error === 'object' && responseData.error !== null && 'message' in responseData.error && typeof responseData.error.message === 'string') {
                     userMessage = responseData.error.message;
                }
                else if ('message' in responseData && typeof responseData.message === 'string') {
                     userMessage = responseData.message;
                }
           } else if (typeof responseData === "string" && responseData.length > 0) {
               userMessage = responseData;
           }
        } else if (axiosMessage) {
            userMessage = axiosMessage;
        }

        const apiError: ApiError = new Error(userMessage) as ApiError;
        apiError.name = 'ApiError';
        apiError.status = response?.status;
        apiError.statusText = response?.statusText;
        apiError.url = config?.url;
        apiError.method = config?.method?.toUpperCase();
        apiError.data = response?.data;
        apiError.isAuthError = response?.status === 401;
        apiError.isNetworkError = !response && (axiosMessage === 'Network Error' || code === 'ECONNABORTED' || code === 'ERR_NETWORK');

        const logMethod = (apiError.isAuthError && (apiError.url?.includes('/auth/login') || apiError.url?.includes('/auth/register')))
            ? console.warn
            : console.error;

        logMethod(
            `API Error: ${apiError.status ?? (apiError.isNetworkError ? 'Network' : 'Unknown')} on ${apiError.method || 'N/A'} ${apiError.url || 'N/A'}`,
            `\n  Message: ${apiError.message}`,
             (apiError.data && typeof apiError.data !== 'string' && Object.keys(apiError.data).length > 0) ? `\n  Data: ${JSON.stringify(apiError.data)}` : ''
        );

        return Promise.reject(apiError);
      },
    );
  }

  /**
   * Performs a GET request.
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Performs a POST request.
   */
  async post<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Performs a PUT request.
   */
   async put<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Performs a PATCH request.
   */
  async patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * Performs a DELETE request.
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

const apiClient = new ApiClient();
export default apiClient;