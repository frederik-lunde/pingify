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
    website?: {
        id: number;
        url: string;
        name?: string | null;
    };
}

/** Represents the user's specific settings and aggregated data for a monitored website. */
export interface WebsiteUser {
  id: number;
  userId: string;
  websiteId: number;
  name: string | null;
  interval: number | null;
  alertEnabled: boolean;
  alertThreshold: number | null;
  notifyEmail: string | null;
  createdAt: string;
  isPinned: boolean;
  website?: Website;
  latestResult?: MonitoringResult | null;
  chartData?: ChartDataPoint[];
  uptimePercent?: number | null
  currentIncident?: Incident | null;
}

/** Represents an active alert notification record. */
export interface Alert {
    id: number;
    websiteId: number;
    userId: string;
    type: AlertType;
    message: string;
    createdAt: string;
    incidentId?: number;
    website?: {
        id: number;
        url: string;
        name?: string | null;
    };
    user?: {
        id: string;
        name: string | null;
    }
    incident?: {
        id: number;
        startTime?: string;
        endTime?: string | null;
    }
}


// --- SECTION 3: API DTOs (Data Transfer Objects - Sent from Frontend) ---

/** DTO for adding a website TO A USER's dashboard. */
export interface AddWebsiteUserDTO {
  url: string;
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
  alertEnabled?: boolean | null;
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
    currentPassword?: string;
    newPassword?: string;
}


// --- SECTION 4: API Query Options (Parameters for GET requests) ---

/** Options for fetching monitoring results lists. */
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
  websiteId?: number;
}

/** Options for fetching active alerts list. */
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;
  to?: Date;
  websiteId?: number;
}

/** Options for fetching incidents list. */
export interface IncidentQueryOptions {
    limit?: number;
    type?: IncidentType;
    from?: Date;
    to?: Date;
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
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  lastCheck: string | null;
  incidentCount: number;
  downIncidentCount: number;
  slowIncidentCount: number;
}

/** Overall statistics summary for the user's dashboard view. */
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
  incidentsLast24h: number;
  lastIncidentTimestamp: string | null;
  lastIncidentWebsiteId?: number | null;
}

/** Represents a single data point formatted for chart display. */
export interface ChartDataPoint {
    label: string;
    timestamp: number;
    avgResponseTime: number | null;
    uptimeRatio: number;
    checkCount: number;
}

/** Detailed data structure for the single website details page. */
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;
  url: string;
  latestResult: MonitoringResult | null;
  chartData: ChartDataPoint[];
  recentChecks: MonitoringResult[];
  uptimePercent: number;
  currentIncident: Incident | null;
  recentIncidents: Incident[];
}

/** Standard response shape for authentication endpoints. */
export interface AuthResponse {
    token: string;
    user: User;
}

/** Aggregated statistics about the user's active alerts. */
export interface AlertStats {
  totalAlerts: number;
  byType: Partial<Record<AlertType, number>>;
  byWebsite: Array<{
    websiteId: number;
    websiteName: string;
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
  loading: boolean;
  error: string | null;
  logout: () => void; // Assuming logout returns void or Promise<void>
}


/** Structure returned by the useWebsiteData hook */
export interface WebsiteDataSummary {
    websiteCards: WebsiteUser[];
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    // --- FIX: Use unknown instead of any ---
    refetch: () => Promise<unknown>; // Use unknown for safer promise result handling
    totalWebsitesCount: number;
    upWebsitesCount: number;
    incidentsLast24h: number | null;
    lastIncidentTimestamp: string | null | undefined;
    lastIncidentWebsiteId: number | null | undefined;
}

/** Standardized structure for API errors (as received/parsed by frontend). */
export interface ApiError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  // --- FIX: Use unknown instead of any ---
  data?: unknown; // Use unknown for the raw error response body
  isAuthError?: boolean;
  isNetworkError?: boolean;
}