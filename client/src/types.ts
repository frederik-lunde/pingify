// /types/index.ts (Shared location)



// --- SECTION 2: Manually Defined Core Types (Reflecting API Payloads) ---
// Define core types manually if the exact shape transferred via API
// (e.g., Date as string) differs from the direct Prisma types.

export interface MonitoringResult {
  id: number;
  websiteId: number;
  checkedAt: string; // ISO 8601 date string (as it likely comes via JSON)
  responseTime: number | null; // Milliseconds
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
   // Optional nested data depending on the query that fetched this result
  website?: {
    url: string;
    websiteUsers?: Array<{ name?: string | null }>;
  };
}

export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null; // ISO 8601 date string
  globalInterval: number;
  createdAt?: string; // ISO 8601 date string
  updatedAt?: string; // ISO 8601 date string
}

export interface User {
  id: number;
  email: string;
  name?: string | null;
  // Add other fields as needed (e.g., emailVerified, roles)
}

export interface WebsiteUser {
    id: number;
    userId: number;
    websiteId: number;
    name: string | null; // Allow null based on backend DTO
    interval: number | null; // Allow null based on backend DTO
    alertEnabled: boolean;
    alertThreshold: number | null;
    notifyEmail: string | null;
    createdAt: string; // ISO 8601 date string
   // updatedAt: string; // ISO 8601 date string
     // Nested Website is commonly included when fetching a user's websites
    website?: Website;
}

export type AlertType = "down" | "slow" | "recovered" | "ssl" | "dns"; // Define allowed alert types

export interface Alert {
    id: number;
    websiteId: number;
    type: AlertType;
    message: string;
    isResolved: boolean;
    resolvedAt: string | null; // ISO 8601 date string
    createdAt: string; // ISO 8601 date string
    // Optional nested data
    website?: {
        url: string;
        websiteUsers?: Array<{ name: string | null }>;
    };
}

export interface AlertUser {
    id: number;
    userId: number;
    alertId: number;
    isRead: boolean;
    createdAt: string; // ISO 8601 date string
     // Nested Alert object is often included
    alert?: Alert;
}


// --- SECTION 3: Utility & Shared Enum Types ---

/**
* Defines the standard keys used for selecting timeframes in the UI and API requests.
*/
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
* Standardized structure for API errors, extending the base Error class.
* Used for communicating errors between backend and frontend.
*/
export interface ApiError extends Error {
  name: string;        // e.g., 'ApiError', 'ValidationError', or Error name
  status?: number;    // HTTP status code (e.g., 404, 500)
  statusText?: string;// HTTP status text (e.g., 'Not Found')
  url?: string;       // API endpoint URL requested
  method?: string;    // HTTP method used (e.g., 'GET', 'POST')
  data?: any;         // Optional response body from the server
  isAuthError?: boolean; // True if related to authentication (e.g., 401)
  isNetworkError?: boolean; // True if due to a network issue
}


// --- SECTION 4: API DTOs (Data Transfer Objects) ---
// Define the shapes expected for specific API requests (POST, PUT).

/**
* DTO for creating the core Website entity (backend internal/admin).
*/
export interface CreateWebsiteDTO {
  url: string;
  interval?: number;
}

/**
* DTO for adding a website TO A USER's dashboard (sent from frontend).
*/
export interface AddWebsiteUserDTO {
  url: string;                 // Required to find/create the website
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean;      // Frontend might send boolean directly
  notifyEmail?: string | null;
}

/**
* DTO for UPDATING a user's settings for a website (sent from frontend).
*/
export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
}

/**
* Credentials required for the user login API endpoint.
*/
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
* Data required for the user registration API endpoint.
*/
export interface RegisterUserData {
  email: string;
  password: string;
  name?: string; // Optional display name
}


// --- SECTION 5: API Query Options ---

/**
* Options for filtering API queries that retrieve lists of monitoring results.
*/
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;         // Backend service methods often use Date
  to?: Date;           // Backend service methods often use Date
  websiteId?: number;
  userId?: number;
}

/**
* Options for filtering API queries that retrieve lists of alerts.
*/
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;         // Use Date for backend service methods
  to?: Date;           // Use Date for backend service methods
  isResolved?: boolean;
  isRead?: boolean;    // Added from frontend needs
  userId?: number;
  websiteId?: number;
}


// --- SECTION 6: API Response Shapes & ViewModels ---
// Define the shapes of complex data returned by specific API endpoints.

/**
* Represents the raw outcome of a single website check performed by the monitoring service.
* (Primarily used internally in backend service).
*/
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

/**
* Structure for aggregated statistics calculated for a single website over a defined period.
* Returned by stats endpoints.
*/
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;         // User's custom name or URL
  url: string;
  uptime: number;              // Uptime percentage (0-100)
  averageResponseTime: number | null; // Avg response time (ms) - CAN BE NULL
  totalChecks: number;         // Total checks performed in the period
  lastCheck: string | null;    // Timestamp of the most recent check (ISO string)
  consecutiveFailures: number; // Current count of consecutive failed checks
}

/**
* Represents the overall statistics summary for the user's dashboard.
*/
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null; // CAN BE NULL
}

/**
* Represents the data specifically formatted or aggregated for chart display.
* Returned within WebsiteDetailsData.
*/
export interface ChartDataPoint {
    label: string;
    timestamp: number; // Unix timestamp (seconds)
    avgResponseTime: number | null; // Actual or Average (ms)
    uptimeRatio: number; // 0.0 to 1.0
    checkCount: number; // 1 for raw, N for aggregated
}

/**
* Data structure for the detailed view of a single website.
* Returned by the `/monitoring/website/{id}` endpoint.
* This is the definitive structure matching the refactored backend.
*/
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;                      // User's custom name or the URL
  url: string;
  latestResult: MonitoringResult | null; // Full MonitoringResult shape
  chartData: ChartDataPoint[];       // Array of points formatted for charts
  recentChecks: MonitoringResult[];  // Array of full MonitoringResult shapes
  uptimePercent: number;             // Calculated uptime for the selected timeframe
}

/**
* Authentication response containing token and user details.
*/
export interface AuthResponse {
    token: string;
    user: User; // Uses the shared User type
}

/**
* Alert statistics summary.
*/
export interface AlertStats {
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  byType: Partial<Record<AlertType, number>>;
  byWebsite: Array<{
    websiteId: number;
    websiteName: string; // Requires joining/fetching name
    count: number;
  }>;
}


// --- SECTION 7: Frontend Specific Context/Hook Types ---
// Types used exclusively within the frontend application state/logic.

/**
 * Type provided by AuthContext (e.g., via useAuth hook).
 */
export interface AuthContextType {
  user: User | null; // Uses the shared User type
  token: string | null;
  loading: boolean; // Initial auth check loading state
  error: string | null; // Error during initial auth check
  logout: () => void;
  // Login/Register likely trigger mutations, not direct context methods
}

/**
 * Combined data structure often used for displaying website cards on a dashboard.
 */
export interface WebsiteWithResults {
  userWebsite: WebsiteUser; // Uses the shared WebsiteUser type
  latestResult?: MonitoringResult; // Uses the shared MonitoringResult type
  recentResults: MonitoringResult[]; // Uses the shared MonitoringResult type
}

/**
 * Structure returned by the `useWebsiteData` hook (likely for a dashboard view).
 */
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[];
    overallStats: OverallStats | null; // Uses the shared OverallStats type
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null; // Uses the shared ApiError type
    refetch: () => Promise<any>;
}