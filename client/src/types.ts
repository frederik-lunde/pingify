/*
* client/src/types.ts
* Defines the core data structures used throughout the frontend application,
* primarily reflecting the expected shapes of data received from the API
* and data sent to the API (DTOs).
*/

// --- SECTION 1: Primitive Type Aliases & Enums ---

/** Defines valid keys for selecting timeframes in UI and API requests. */
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';
export const VALID_TIMEFRAMES = ['hour', 'day', 'week', 'month', 'year'] as const;

/** Defines valid incident types used in API responses and filters. */
export type IncidentType = 'down' | 'slow';
export const VALID_INCIDENT_TYPES = ['down', 'slow'] as const;

/** Defines valid alert types (currently same as incident types). */
export type AlertType = 'down' | 'slow';
export const VALID_ALERT_TYPES = ['down', 'slow'] as const;

/** Defines valid incident status filters for API queries. */
export type IncidentStatusFilter = 'open' | 'closed';
export const VALID_INCIDENT_STATUSES = ['open', 'closed'] as const;

/** Defines valid fields for sorting monitoring results via API. */
export type MonitoringResultSortBy = 'checkedAt' | 'isAvailable' | 'responseTime' | 'statusCode' | 'id';
export const VALID_SORT_BY: MonitoringResultSortBy[] = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'];

/** Defines valid sort directions for API queries. */
export type SortDirection = 'asc' | 'desc';
export const VALID_SORT_DIR: SortDirection[] = ['asc', 'desc'];

/** Defines dashboard website sort options (frontend specific). */
export const SORT_OPTIONS = ['name-asc', 'name-desc', 'response-asc', 'response-desc'] as const;
export type SortOption = typeof SORT_OPTIONS[number];

// --- SECTION 2: Core API Entity Types (as received from backend) ---

/** Represents a single monitoring check result. */
export interface MonitoringResult {
  id: number;
  websiteId: number;
  checkedAt: string; // ISO 8601 date string
  responseTime: number | null; // Milliseconds
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  // Optional nested data if the specific API endpoint includes it
  website?: {
    url: string;
    name?: string | null; // User's custom name might be included
  };
}

/** Represents core website data. */
export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null; // ISO 8601 date string
  globalInterval: number;
  createdAt?: string; // ISO 8601 date string
  updatedAt?: string; // ISO 8601 date string
  // Note: User's custom name is typically in WebsiteUser, but API might denormalize
  name?: string | null;
}

/** Represents basic user information. */
export interface User {
  id: string; // User ID is a string (CUID)
  email: string;
  name?: string | null;
}

/** Represents an incident record (downtime or slow response period). */
export interface Incident {
    id: number;
    websiteId: number;
    type: IncidentType;
    startTime: string; // ISO 8601 date string
    endTime: string | null; // ISO 8601 date string or null if ongoing
    durationSeconds: number | null; // Duration in seconds if ended
    initialResultId?: number | null;
    confirmingResultId?: number | null;
    resolvingResultId?: number | null;
    // Optional nested data if the specific API endpoint includes it
    website?: {
        id: number; // Included for consistency
        url: string;
        name?: string | null; // User's custom name might be included
    };
}

/** Represents the user's specific settings and aggregated data for a monitored website. */
export interface WebsiteUser {
  id: number;
  userId: string; // User ID is a string
  websiteId: number;
  name: string | null; // User-defined alias
  interval: number | null; // User-specific interval override (seconds)
  alertEnabled: boolean;
  alertThreshold: number | null; // Response time threshold (ms) for alerts
  notifyEmail: string | null; // User preference for email alerts (email address or null)
  createdAt: string; // ISO 8601 date string
  isPinned: boolean; // User preference to pin the website

  // --- Data Added by Backend Service/Controllers for specific views ---
  website?: Website; // Nested core website data (e.g., in dashboard list)
  latestResult?: MonitoringResult | null; // Last monitoring result (e.g., in dashboard list)
  chartData?: ChartDataPoint[]; // Pre-calculated chart data (e.g., in dashboard list)
  uptimePercent?: number; // Uptime percentage (e.g., in dashboard list)
  currentIncident?: Incident | null; // Current open incident (e.g., in dashboard list)
}

/** Represents an active alert notification record. */
export interface Alert {
    id: number;
    websiteId: number;
    userId: string; // User ID is a string
    type: AlertType;
    message: string;
    createdAt: string; // ISO 8601 date string
    incidentId?: number; // Link to the incident that triggered the alert
    // Optional nested data included by backend controllers
    website?: {
        id: number;
        url: string;
        name?: string | null; // User's custom name for this website
    };
    user?: { // Might be included if fetching alerts across users (admin view)
        id: string; // User ID is string
        name: string | null;
    }
    incident?: { // Basic incident info might be included
        id: number;
        startTime?: string;
        endTime?: string | null;
    }
    // Note: 'status' (active/dismissed) is managed implicitly.
    // Active alerts are fetched, dismissed alerts are deleted via API.
}


// --- SECTION 3: API DTOs (Data Transfer Objects - Sent from Frontend) ---

/** DTO for adding a website TO A USER's dashboard. */
export interface AddWebsiteUserDTO {
  url: string; // Required to find/create the website
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

/** DTO for UPDATING a user's settings for a website. */
export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null; // Use boolean | null if you need to unset
  notifyEmail?: string | null;
  isPinned?: boolean;
}

/** DTO specifically for updating the pin status via PATCH. */
export interface SetPinStatusDTO {
    isPinned: boolean;
}

/** DTO for user login. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** DTO for user registration. */
export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

/** DTO for updating user profile (name/email). */
export interface UpdateUserProfileDTO {
    name?: string;
    email?: string;
}

/** DTO for updating user password. */
export interface UpdateUserPasswordDTO {
    currentPassword?: string; // Make optional for type safety, but API requires it
    newPassword?: string;     // Make optional for type safety, but API requires it
}


// --- SECTION 4: API Query Options (Parameters for GET requests) ---

/** Options for fetching monitoring results lists. */
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date; // Frontend might use Date objects for selection
  to?: Date;
  websiteId?: number;
  // userId?: string; // Usually inferred from auth token on backend
}

/** Options for fetching active alerts list. */
export interface AlertQueryOptions {
  limit?: number;
  // offset?: number; // Add if API supports pagination
  type?: AlertType;
  from?: Date;
  to?: Date;
  // userId?: string; // Usually inferred from auth token
  websiteId?: number; // Optional: Filter user's alerts for a specific website
}

/** Options for fetching incidents list. */
export interface IncidentQueryOptions {
    limit?: number;
    // offset?: number; // Add if API supports pagination
    type?: IncidentType;
    from?: Date;
    to?: Date;
    // userId?: string; // Usually inferred from auth token
    websiteId?: number;
    status?: IncidentStatusFilter;
}


// --- SECTION 5: API Response Shapes & Aggregated ViewModels ---

/** Raw outcome of a single monitoring check (less common in UI). */
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

/** Aggregated stats for a single website over a period. */
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string; // User's name or URL
  url: string;
  uptime: number; // Percentage
  averageResponseTime: number | null; // Milliseconds
  totalChecks: number;
  lastCheck: string | null; // ISO string
  incidentCount: number; // Total incidents started in period
  downIncidentCount: number;
  slowIncidentCount: number;
}

/** Overall statistics summary for the user's dashboard view. */
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[]; // Stats for each monitored website
  overallUptime: number; // Avg uptime across websites for the period
  overallResponseTime: number | null; // Avg response time for the period
  incidentsLast24h: number; // Count of incidents started in last 24h
  lastIncidentTimestamp: string | null; // Start time of the absolute most recent incident
  lastIncidentWebsiteId?: number | null; // Website ID of the most recent incident
}

/** Represents a single data point formatted for chart display. */
export interface ChartDataPoint {
    label: string; // e.g., 'HH:mm', 'MMM d'
    timestamp: number; // Unix timestamp (seconds) for sorting/reference
    avgResponseTime: number | null; // Avg response time for this interval
    uptimeRatio: number; // 0.0 to 1.0 uptime ratio for this interval
    checkCount: number; // How many checks fall into this interval
}

/** Detailed data structure for the single website details page. */
export interface WebsiteDetailsData {
  websiteId: number;
  name: string; // User's custom name or the URL
  url: string;
  latestResult: MonitoringResult | null;
  chartData: ChartDataPoint[];
  recentChecks: MonitoringResult[]; // Sorted/limited list of recent checks
  uptimePercent: number; // Calculated uptime for the selected timeframe
  currentIncident: Incident | null; // Details of the currently open incident, if any
  recentIncidents: Incident[]; // List of recent incidents (e.g., last 10)
}

/** Standard response shape for authentication endpoints. */
export interface AuthResponse {
    token: string;
    user: User; // Contains id, email, name
}

/** Aggregated statistics about the user's active alerts. */
export interface AlertStats {
  totalAlerts: number;
  byType: Partial<Record<AlertType, number>>; // Counts for 'down', 'slow'
  byWebsite: Array<{
    websiteId: number;
    websiteName: string; // User's custom name or URL
    count: number;
  }>;
}

/** Response shape for the incident count endpoint. */
export interface IncidentCountResponse {
  incidentCount: number;
}


// --- SECTION 6: Frontend Specific Context/State/Hook Types ---

/** Structure for the Authentication Context. */
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean; // Indicates if auth state is being determined
  error: string | null; // Stores auth-related errors
  logout: () => void;
}

/** Example combined type used for displaying website cards on the dashboard. */
// Renamed from WebsiteCardData to avoid confusion, WebsiteUser now holds all necessary data.
// export interface WebsiteCardData extends WebsiteUser { ... } // No longer needed

/** Structure returned by the useWebsiteData hook */
export interface WebsiteDataSummary {
    websiteCards: WebsiteUser[]; // Uses WebsiteUser directly
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>;
    totalWebsitesCount: number;
    upWebsitesCount: number;
    incidentsLast24h: number | null;
    lastIncidentTimestamp: string | null | undefined;
    lastIncidentWebsiteId: number | null | undefined;
}

/** Standardized structure for API errors (as received/parsed by frontend). */
export interface ApiError extends Error {
  name: string; // Usually 'ApiError'
  status?: number; // HTTP status code (e.g., 400, 401, 404, 500)
  statusText?: string; // HTTP status text (e.g., 'Bad Request')
  url?: string; // The URL that caused the error
  method?: string; // HTTP method (e.g., 'GET', 'POST')
  data?: any; // The response body from the server on error (could be { message: ... } or other structure)
  isAuthError?: boolean; // True if status is 401
  isNetworkError?: boolean; // True if the request failed to send/receive
}

// REMOVED WebsiteWithResults as it's no longer needed.
// The WebsiteUser type now contains all necessary nested data.