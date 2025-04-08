// client/src/types.ts

// --- SECTION 1: Keep Basic Prisma Type Names if helpful for context, but don't rely on backend structure ---
// These are just illustrative names now for the concepts
export type WebsitePrismaConcept = {};
export type MonitoringResultPrismaConcept = {};
export type AlertPrismaConcept = {};
export type UserPrismaConcept = {};
export type WebsiteUserPrismaConcept = {};


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
}

export interface User {
  id: number;
  email: string;
  name?: string | null;
  // Any other user fields needed by the frontend
}

// Represents the user's specific settings for a website
export interface WebsiteUser {
    id: number;
    userId: number;
    websiteId: number;
    name: string | null; // User's custom name for this site
    interval: number | null; // User's custom interval
    alertEnabled: boolean;
    alertThreshold: number | null; // User's custom threshold
    notifyEmail: string | null; // User's notification email for this site
    createdAt: string; // ISO 8601 date string
    isPinned: boolean;
    // Nested Website object is commonly included when fetching user's dashboard data
    website?: Website;
    // --- ADDED DOWNTIME FIELDS (Optional) ---
    // These fields are populated by the backend API (`/websites/user/dashboard`)
    // ONLY when the latest status is determined to be 'down'.
    consecutiveFailures?: number;
    downtimeStartedAt?: string | null; // ISO 8601 date string
    // --- END ADDED ---
}

// --- UPDATED ALERT TYPES ---

// Define the *simplified* alert types matching the refactored backend
export type AlertType = "down" | "slow";
export const VALID_ALERT_TYPES: AlertType[] = ["down", "slow"]; // For validation if needed

// Simplified Alert interface (matching backend API response)
export interface Alert {
    id: number;
    websiteId: number;
    userId: number; // Direct relation shown in response
    type: AlertType;
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
    // REMOVED: isResolved, resolvedAt
}

// --- AlertUser REMOVED ---


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
  userId?: number; // May not be needed if API infers from auth
}

// Simplified Alert Query Options (matching backend API)
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType; // Only 'down' or 'slow'
  from?: Date;      // Use Date objects in frontend state/UI
  to?: Date;
  userId?: number;  // Optional: Filter user's alerts further (usually not needed)
  websiteId?: number;// Optional: Filter user's alerts for a specific website
  // REMOVED: isResolved, isRead filters
}


// --- SECTION 6: API Response Shapes & ViewModels ---

// Raw check outcome (might be used internally, less likely directly in UI)
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

// Stats for a single website
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  lastCheck: string | null; // ISO string
  consecutiveFailures: number;
}

// Overall dashboard stats
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
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
// Backend includes these fields if latestResult is down
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;
  url: string;
  latestResult: MonitoringResult | null; // Uses shared MonitoringResult
  chartData: ChartDataPoint[];
  recentChecks: MonitoringResult[]; // Uses shared MonitoringResult
  uptimePercent: number;
  // --- ADDED DOWNTIME FIELDS (Optional) ---
  consecutiveFailures?: number;
  downtimeStartedAt?: string | null; // ISO 8601 date string
  // --- END ADDED ---
}

// Auth API response
export interface AuthResponse {
    token: string;
    user: User; // Uses shared User type
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
// This type is used by useWebsiteData hook and passed to WebsiteGrid/WebsiteCard
// It uses the updated WebsiteUser type which includes optional downtime fields
export interface WebsiteWithDetails {
  userWebsite: WebsiteUser; // User's settings + nested Website core data + OPTIONAL DOWNTIME INFO
  latestResult?: MonitoringResult; // Latest check result
  activeAlertCount?: number; // Example: Count of active alerts for this site/user
}

// Example structure returned by a high-level dashboard data hook
// This uses WebsiteWithDetails above
export interface WebsiteDataSummary {
    websitesWithDetails: WebsiteWithDetails[];
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<any>; // Function to refetch dashboard data
    totalWebsitesCount: number;
    upWebsitesCount: number;
}