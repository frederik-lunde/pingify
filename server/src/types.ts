// server/src/types.ts
import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  Alert as PrismaAlert,
  User as PrismaUser,
  WebsiteUser as PrismaWebsiteUser,
  Incident as PrismaIncident, // Import new Prisma type
  Prisma, // Import Prisma namespace for SortOrder etc.
} from '@prisma/client';

// Re-export core Prisma types if needed directly elsewhere
export type WebsitePrisma = PrismaWebsite;
export type MonitoringResultPrisma = PrismaMonitoringResult;
export type AlertPrisma = PrismaAlert;
export type UserPrisma = PrismaUser;
export type WebsiteUserPrisma = PrismaWebsiteUser;
export type IncidentPrisma = PrismaIncident; // Export new Prisma type

// --- SECTION 2: Core API/Service Types (Reflecting New Schema) ---

export interface MonitoringResult {
  id: number;
  websiteId: number;
  checkedAt: string; // ISO 8601 date string
  responseTime: number | null; // Milliseconds
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  website?: { // Optional relation load (Primarily for frontend display convenience)
    url: string;
    name?: string | null; // Could be the user's custom name
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
  id: string;
  email: string;
  name?: string | null;
}

export interface WebsiteUser {
  id: number;
  userId: string;
  websiteId: number;
  name: string | null; // User-defined alias
  interval: number | null; // User-specific interval override (seconds)
  alertEnabled: boolean;
  alertThreshold: number | null; // Response time threshold (ms) for alerts
  notifyEmail: string | null; // User's email for notifications
  createdAt: string; // ISO 8601 date string
  isPinned: boolean; // User preference to pin the website

  // --- Data Added by Backend Service ---
  website?: Website; // Nested core website data
  latestResult?: MonitoringResult | null; // Last monitoring result
  chartData?: ChartDataPoint[]; // Pre-calculated chart data for the card (daily, last 24 points)
  uptimePercent?: number; // Uptime percentage for the card timeframe (e.g., 'day')
  currentIncident?: Incident | null; // Add current open incident if any
}

// Define the *simplified* alert types based on the new schema/requirements
export type AlertType = "down" | "slow";
export const VALID_ALERT_TYPES = ["down", "slow"] as const; // Use 'as const' for stricter typing

export interface Alert {
  id: number;
  websiteId: number;
  userId: string; // Direct relation shown in response
  type: AlertType;
  message: string;
  createdAt: string; // ISO 8601 date string
  incidentId?: number; // <-- Add optional incidentId
  // Optional nested data included by backend controllers
  website?: {
      id: number;
      url: string;
      name?: string | null; // User's custom name for this website
  };
  user?: { // Included by some backend endpoints (e.g., getAlertsByWebsite)
      id: string; // User ID is string
      name: string | null;
  }
  // Optional nested incident details if included by backend
  incident?: {
      id: number;
      startTime?: string;
      endTime?: string | null;
  }
}


// --- NEW: Incident Type ---
export type IncidentType = "down" | "slow"; // Same as AlertType for now
export const VALID_INCIDENT_TYPES = ["down", "slow"] as const; // Use 'as const'

export interface Incident {
    id: number;
    websiteId: number;
    type: IncidentType;
    startTime: string; // ISO 8601 date string
    endTime: string | null; // ISO 8601 date string or null
    durationSeconds: number | null;
    initialResultId: number | null;
    confirmingResultId: number | null;
    resolvingResultId: number | null;
    // Optional nested data for API responses
    website?: {
        id: number;
        url: string;
        name?: string | null; // User's custom name for this website
    };
    // Optional: Include results if needed, but can be large
    // initialResult?: MonitoringResult | null;
    // confirmingResult?: MonitoringResult | null;
    // resolvingResult?: MonitoringResult | null;
}


// --- SECTION 3: Utility & Shared Types ---

/**
* Defines the standard keys used for selecting timeframes in the UI and API requests.
*/
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';
export const VALID_TIMEFRAMES = ['hour', 'day', 'week', 'month', 'year'] as const;

/**
 * Defines valid fields for sorting monitoring results.
 */
export type MonitoringResultSortBy = keyof Pick<Prisma.MonitoringResultOrderByWithRelationInput, 'checkedAt' | 'isAvailable' | 'responseTime' | 'statusCode' | 'id'>;
export const VALID_SORT_BY = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'] as const;

/**
 * Defines valid sort directions.
 */
export type SortDirection = Prisma.SortOrder;
export const VALID_SORT_DIR = ['asc', 'desc'] as const;

/**
 * Defines valid incident status filters.
 */
export type IncidentStatusFilter = 'open' | 'closed';
export const VALID_INCIDENT_STATUSES = ['open', 'closed'] as const;

/**
* Standardized structure for API errors.
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

// --- SECTION 4: API DTOs (Data Transfer Objects) ---
// Keep DTOs relevant to website management, user auth etc.
// Alert creation is now internal, not via API DTO.

export interface AddWebsiteUserDTO {
  url: string;
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

// DTO specifically for updating the pin status
export interface SetPinStatusDTO {
    isPinned: boolean;
}

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

export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
  websiteId?: number;
  userId?: string; // Still useful if filtering results viewable by user
}

// Simplified Alert Query Options
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType; // Only 'down' or 'slow'
  from?: Date;
  to?: Date;
  userId?: string;   // Filter by user
  websiteId?: number;// Filter by website
}

// --- NEW: Incident Query Options ---
export interface IncidentQueryOptions {
    limit?: number;
    type?: IncidentType;
    from?: Date; // Filter by startTime >= from
    to?: Date; // Filter by startTime <= to
    userId?: string; // Filter by user who monitors the website
    websiteId?: number; // Filter by specific website
    status?: IncidentStatusFilter; // Filter by incident status
}


// --- SECTION 6: API Response Shapes & ViewModels ---

/**
 * Represents the raw outcome of a single website check performed by the monitoring service.
 * (Primarily used internally between monitoring functions before saving to DB).
 */
export interface MonitoringResponse {
  responseTime: number | null; // Milliseconds
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

/**
* Structure for aggregated statistics calculated for a single website over a defined period.
*/
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number; // Uptime percentage over the period
  averageResponseTime: number | null; // Average response time over the period
  totalChecks: number; // Total checks in the period
  lastCheck: string | null; // ISO 8601 string of the last check (anytime)
  incidentCount: number; // Total incidents started in the period
  downIncidentCount: number; // 'down' incidents started in the period
  slowIncidentCount: number; // 'slow' incidents started in the period
}

/**
* Represents the overall statistics summary for the user's dashboard.
*/
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[]; // Stats for each website *over the selected period*
  overallUptime: number; // Average uptime across websites *over the selected period*
  overallResponseTime: number | null; // Average response time across websites *over the selected period*
  incidentsLast24h: number; // Count of incidents started in last 24h
  lastIncidentTimestamp?: string | null; // Start time of the most recent incident
  lastIncidentWebsiteId?: number | null; // Website ID of the most recent incident
}

/**
* Represents the data specifically formatted or aggregated for chart display.
*/
export interface ChartDataPoint {
    label: string;
    timestamp: number; // Unix timestamp (seconds)
    avgResponseTime: number | null;
    uptimeRatio: number; // 0.0 to 1.0
    checkCount: number;
}

/**
 * Data structure for the detailed view of a single website.
 * Returned by the `/monitoring/website/{id}` endpoint.
 */
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;                      // User's custom name or the URL
  url: string;
  latestResult: MonitoringResult | null; // Uses the shared MonitoringResult type
  chartData: ChartDataPoint[];       // Array of points formatted for charts
  recentChecks: MonitoringResult[];  // Array of shared MonitoringResult types
  uptimePercent: number;             // Calculated uptime for the selected timeframe
  currentIncident?: Incident | null; // Details of the currently open incident, if any
  recentIncidents?: Incident[]; // List of recent incidents (e.g., last 7 days)
}


/**
* Authentication response containing token and user details.
*/
export interface AuthResponse {
    token: string;
    user: User;
}

// Simplified Alert Statistics
export interface AlertStats {
  totalAlerts: number; // Total *active* alerts matching filters
  byType: Partial<Record<AlertType, number>>;
  byWebsite: Array<{
    websiteId: number;
    websiteName: string; // User's custom name or URL
    count: number;
  }>;
}

/**
 * Response type for the count of recent incidents.
 */
export interface IncidentCountResponse {
    incidentCount: number;
}

// --- SECTION 7: Frontend Specific Context/Hook Types ---
// Adapt as needed for frontend state management

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

export interface WebsiteIncidentInfo {
  websiteId: number;
  name: string | null; // User's name for the website
  url: string;
  
}