/*
* client/src/types.ts
*

*/
// --- SECTION 1: Keep Basic Prisma Type Names if helpful for context, but don't rely on backend structure ---
// These are just illustrative names now for the concepts
export type WebsitePrismaConcept = {};
export type MonitoringResultPrismaConcept = {};
export type AlertPrismaConcept = {};
export type UserPrismaConcept = {};
export type WebsiteUserPrismaConcept = {};
// --- NEW: Incident Concept ---
export type IncidentPrismaConcept = {};


// --- SECTION 2: Core Frontend/API Types (Reflecting API Payloads/Responses) ---

export interface MonitoringResult {
  id: number;
  websiteId: number;  
  checkedAt: string; // ISO 8601 date string (from JSON)
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


export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null; // ISO 8601 date string
  globalInterval: number;
  createdAt?: string; // ISO 8601 date string
  updatedAt?: string; // ISO 8601 date string
  name?: string | null; // User's custom name might be included here too
}

export interface User {
  id: number;
  email: string;
  name?: string | null;
  // Any other user fields needed by the frontend
}

// --- NEW: Incident Type ---
export type IncidentType = 'down' | 'slow';
export const VALID_INCIDENT_TYPES: IncidentType[] = ['down', 'slow'];

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

// Represents the user's specific settings for a website
export interface WebsiteUser {
  id: number;
  userId: string;
  websiteId: number;
  name: string | null; // User-defined alias
  interval: number | null; // User-specific interval override (seconds)
  alertEnabled: boolean;
  alertThreshold: number | null; // Response time threshold (ms) for alerts
  notifyEmail: string | null; // User preference for email alerts (email address or null)
  createdAt: string; // ISO 8601 date string
  isPinned: boolean; // User preference to pin the website

  // --- Data Added by Backend Service ---
  website?: Website; // Nested core website data
  latestResult?: MonitoringResult | null; // Last monitoring result
  chartData?: ChartDataPoint[]; // Pre-calculated chart data for the card (daily, last 24 points)
  uptimePercent?: number; // Uptime percentage for the card timeframe (e.g., 'day')
  currentIncident?: Incident | null; // Current open incident for this website
}
// --- UPDATED ALERT TYPES ---

// Define the *simplified* alert types matching the refactored backend
export type AlertType = "down" | "slow";
export const VALID_ALERT_TYPES: AlertType[] = ["down", "slow"]; // For validation if needed

// Define possible Alert statuses (adjust based on your actual API)
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';
export const VALID_ALERT_STATUSES: AlertStatus[] = ['active', 'acknowledged', 'resolved', 'dismissed'];


// Simplified Alert interface (matching backend API response)
export interface Alert {
    id: number;
    websiteId: number;
    userId: string; // Direct relation shown in response
    type: AlertType;
    status: AlertStatus; // Add status to the Alert type itself if returned by API
    message: string;
    createdAt: string; // ISO 8601 date string
    // Optional nested data included by backend controllers
    website?: {
        id: number;
        url: string;
        name?: string | null; // User's custom name for this website
    };
    user?: { // Included by some backend endpoints (e.g., getAlertsByWebsite)
        id: number;
        name: string | null;
    }
}


// --- SECTION 3: Utility & Shared Enum Types ---

export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';

// Standardized structure for API errors (as received/parsed by frontend)
export interface ApiError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: any; // The response body from the server on error
  isAuthError?: boolean;
  isNetworkError?: boolean;
}

// Define SortOption based on the constant used in Dashboard
export const SORT_OPTIONS = ['name-asc', 'name-desc', 'response-asc', 'response-desc'] as const;
export type SortOption = typeof SORT_OPTIONS[number];


// --- SECTION 4: API DTOs (Data Transfer Objects - Sent from Frontend) ---

// DTO for adding a website TO A USER's dashboard
export interface AddWebsiteUserDTO {
  url: string; // Required to find/create the website
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

// DTO for UPDATING a user's settings for a website
export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

// DTO specifically for updating the pin status via PATCH
export interface SetPinStatusDTO {
    isPinned: boolean;
}


// DTOs for Auth
export interface LoginCredentials {
  email: string;
  password: string;
}
export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}


// --- SECTION 5: API Query Options ---

// Options for fetching monitoring results
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date; // Frontend might use Date objects for selection
  to?: Date;
  websiteId?: number;
  userId?: string; // May not be needed if API infers from auth
}

// Simplified Alert Query Options (matching backend API)
export interface AlertQueryOptions {
  limit?: number;
  offset?: number; // Add offset if your API supports pagination
  type?: AlertType; // Only 'down' or 'slow'
  from?: Date;      // Use Date objects in frontend state/UI
  to?: Date;
  userId?: string;  // Optional: Filter user's alerts further (usually not needed)
  websiteId?: number;// Optional: Filter user's alerts for a specific website
  // --- FIX: Add the missing status property ---
  status?: AlertStatus | string; // Allow defined statuses or any string if API is flexible
}

// --- NEW: Incident Query Options ---
export interface IncidentQueryOptions {
    limit?: number;
    offset?: number; // Add offset if your API supports pagination
    type?: IncidentType;
    from?: Date; // Use Date objects in frontend state/UI
    to?: Date;
    userId?: string; // Filter by user (usually implicit from auth)
    websiteId?: number; // Filter by specific website
    status?: 'open' | 'closed'; // Filter by incident status
}


// --- SECTION 6: API Response Shapes & ViewModels ---

// Raw check outcome (might be used internally, less likely directly in UI)
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

// Stats for a single website (Backend now includes incident counts)
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  lastCheck: string | null; // ISO string
  incidentCount: number;
  downIncidentCount: number;
  slowIncidentCount: number;
}

// Overall dashboard stats (Reflects backend changes)
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
  incidentsLast24h: number | null;
  lastIncidentTimestamp: string | null;
  lastIncidentWebsiteId?: number | null;
}

// Data point for charts
export interface ChartDataPoint {
    label: string;
    timestamp: number; // Unix timestamp (seconds)
    avgResponseTime: number | null;
    uptimeRatio: number; // 0.0 to 1.0
    checkCount: number;
}

// Detailed view for a single website page
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

// Auth API response
export interface AuthResponse {
    token: string;
    user: User;
}

// UPDATED Alert Statistics Summary (Match backend)
export interface AlertStats {
  totalAlerts: number; // Total *active* alerts matching filters
  byType: Partial<Record<AlertType, number>>; // Only 'down' and 'slow' keys expected
  byWebsite: Array<{
    websiteId: number;
    websiteName: string; // User's custom name or URL
    count: number;
  }>;
}

// Response structure for incident count endpoint
export interface IncidentCountResponse {
  incidentCount: number;
}


// --- SECTION 7: Frontend Specific Context/Hook Types ---

// Example Auth Context state
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

// Example combined type for dashboard cards/hooks
export interface WebsiteWithResults {
    userWebsite: WebsiteUser;
}

// Example structure returned by a high-level dashboard data hook
export interface WebsiteDataSummary {
    websitesWithResults: WebsiteWithResults[];
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