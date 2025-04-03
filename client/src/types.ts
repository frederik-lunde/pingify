// src/types.ts
// --- Core Monitoring & Website Types ---
export interface MonitoringResult {
  id: number;
  websiteId: number;
  checkedAt: string; // ISO 8601 date string
  responseTime: number | null; // Milliseconds
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  website?: { // Optional relation
    url: string;
    websiteUsers?: Array<{ name: string | null }>;
  };
}

export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null;
  globalInterval: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserWebsite {
  id: number;
  userId: number;
  websiteId: number;
  name: string; // Changed: Assume name is generally required or defaulted server-side
  interval: number; // Changed: Assume interval has a default server-side
  alertEnabled: boolean;
  alertThreshold: number | null;
  notifyEmail: string | null;
  createdAt: string;
  website: Website; // Nested base Website object is expected
}

// --- DTOs ---
export interface WebsiteCreateDTO {
  url: string;
  name: string; // Make name required in DTO for clarity
  interval: number; // Make interval required
  alertEnabled?: boolean; // Optional fields default server-side
  alertThreshold?: number | null;
  notifyEmail?: string | null;
}

export interface WebsiteUpdateDTO {
  name?: string; // All fields optional for update
  interval?: number;
  alertEnabled?: boolean;
  alertThreshold?: number | null;
  notifyEmail?: string | null;
}

// --- Statistics Types ---
export interface WebsiteStats {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number; // Percentage (0-100)
  averageResponseTime: number; // Milliseconds
  totalChecks: number;
  lastCheck: string | null;
  consecutiveFailures: number;
}

export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStats[]; // May not be present depending on endpoint
  overallUptime: number; // Calculated for the period/context
  overallResponseTime: number; // Calculated for the period/context
}

// --- Alert Types ---
export type AlertType = "down" | "slow" | "recovered" | "ssl" | "dns"; // Added common types

export interface Alert {
  id: number;
  websiteId: number;
  type: AlertType;
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  website?: { // Optional relation
    url: string;
    websiteUsers?: Array<{ name: string | null }>;
  };
}

export interface AlertUser {
  id: number;
  userId: number;
  alertId: number;
  isRead: boolean;
  createdAt: string;
  alert: Alert; // Nested Alert object
}

export interface AlertStats {
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  byType: Partial<Record<AlertType, number>>; // Use Partial as not all types might exist
  byWebsite: Array<{
    websiteId: number;
    websiteName: string;
    count: number;
  }>;
}

export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;
  to?: Date;
  isResolved?: boolean;
  isRead?: boolean; // Filter by user's read status (for AlertUser endpoints)
  websiteId?: number; // Added for filtering by website
}

// --- User and Auth Types ---
export interface User {
  id: number;
  email: string;
  name?: string | null;
}

// Type provided by AuthContext (via useAuthCore)
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean; // Initial auth check loading
  error: string | null; // Error during initial check
  logout: () => void;
  // Login/Register are handled by mutation hooks, not directly in context
  // login: (credentials: LoginCredentials & { rememberMe?: boolean }) => Promise<void>;
  // register: (data: RegistrationData) => Promise<void>;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegistrationData {
    email: string;
    password: string;
    name?: string; // Optional name during registration
}

export interface AuthResponse {
    token: string;
    user: User;
}


// --- Time & Data Types ---
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';

// Data structure returned by the `/monitoring/website/{id}/details` endpoint
// Matches the structure expected by useWebsiteDetailsQuery hook
export interface WebsiteDetailsData {
    websiteId: number;
    name: string; // User's custom name or URL
    url: string;
    // Latest result snapshot for header display
    latestResult: Pick<MonitoringResult, 'checkedAt' | 'isAvailable' | 'statusCode' | 'responseTime'> | null;
    // Results within the selected timeframe for charts
    chartData: Pick<MonitoringResult, 'checkedAt' | 'isAvailable' | 'responseTime' | 'statusCode'>[];
    uptimePercent: number; // Calculated uptime for the timeframe
    // Recent checks list (limited) with specific fields
    recentChecks: Pick<MonitoringResult, 'id' | 'checkedAt' | 'isAvailable' | 'statusCode' | 'responseTime'>[];
}

// --- Error Type ---
// Standardized API Error structure used by the ApiClient and hooks
export interface ApiError extends Error {
  name: string; // Added name property for standard Error compatibility
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: any; // Raw response data
  isAuthError?: boolean;
  isNetworkError?: boolean;
}