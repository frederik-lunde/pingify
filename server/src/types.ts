// server/src/types.ts

// --- SECTION 1: Prisma Type Re-exports (Minimal Required) ---
import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  Alert as PrismaAlert,
  User as PrismaUser,
  WebsiteUser as PrismaWebsiteUser,
} from '@prisma/client';

// Re-export core Prisma types if needed directly elsewhere
export type WebsitePrisma = PrismaWebsite;
export type MonitoringResultPrisma = PrismaMonitoringResult;
export type AlertPrisma = PrismaAlert;
export type UserPrisma = PrismaUser;
export type WebsiteUserPrisma = PrismaWebsiteUser;

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
  id: number;
  email: string;
  name?: string | null;
}

export interface WebsiteUser {
    id: number;
    userId: number;
    websiteId: number;
    name: string | null;
    interval: number | null;
    alertEnabled: boolean;
    alertThreshold: number | null;
    notifyEmail: string | null;
    createdAt: string; // ISO 8601 date string
    website?: Website; // Often included when fetching user's monitored sites
    user?: User;       // Less common to include
}

// Define the *simplified* alert types based on the new schema/requirements
export type AlertType = "down" | "slow";
export const VALID_ALERT_TYPES: AlertType[] = ["down", "slow"]; // For validation

export interface Alert {
    id: number;
    websiteId: number;
    userId: number;
    type: AlertType;
    message: string;
    createdAt: string; // ISO 8601 date string
    // Optional nested data for API responses
    website?: {
        id: number;
        url: string;
        // Get the specific user's name for this website for display
        name?: string | null;
    };
    user?: { // Less common but possible
        id: number;
        name: string | null;
    }
}

// --- SECTION 3: Utility & Shared Types ---

/**
* Defines the standard keys used for selecting timeframes in the UI and API requests.
*/
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';

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
}

export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
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
  userId?: number; // Still useful if filtering results viewable by user
}

// Simplified Alert Query Options
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType; // Only 'down' or 'slow'
  from?: Date;
  to?: Date;
  userId?: number;   // Filter by user
  websiteId?: number;// Filter by website
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
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  lastCheck: string | null; // ISO 8601 string
  consecutiveFailures: number; // Still useful info
}

/**
* Represents the overall statistics summary for the user's dashboard.
*/
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
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

// --- SECTION 7: Frontend Specific Context/Hook Types ---
// Adapt as needed for frontend state management

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

// Example structure for dashboard display
export interface WebsiteWithDetails {
  userWebsite: WebsiteUser; // Contains the user's settings for the website
  latestResult?: MonitoringResult; // Shared type
  activeAlertCount?: number; // Derived count of active alerts for this website/user
}