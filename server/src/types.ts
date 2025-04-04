// src/types/index.ts or server/src/types/index.ts (adjust path as needed)

import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  Alert as PrismaAlert,
  User as PrismaUser,
  WebsiteUser as PrismaWebsiteUser,
  AlertUser as PrismaAlertUser
} from '@prisma/client';

// --- Re-export Prisma types for convenience across the application ---
// These are the direct types generated from your schema
export type Website = PrismaWebsite;
export type MonitoringResult = PrismaMonitoringResult;
export type Alert = PrismaAlert;
export type User = PrismaUser;
export type WebsiteUser = PrismaWebsiteUser;
export type AlertUser = PrismaAlertUser;

// --- API Error Type ---
/**
* Standardized structure for API errors, extending the base Error class.
* Used for communicating errors between backend and frontend.
*/
export interface ApiError extends Error {
  name: string;        // e.g., 'ApiError', 'ValidationError'
  status?: number;    // HTTP status code (e.g., 404, 500)
  statusText?: string;// HTTP status text (e.g., 'Not Found')
  url?: string;       // API endpoint URL requested
  method?: string;    // HTTP method used (e.g., 'GET', 'POST')
  data?: any;         // Optional response body from the server
  isAuthError?: boolean; // True if related to authentication (e.g., 401)
  isNetworkError?: boolean; // True if due to a network issue
}

// --- Website-related DTOs (Data Transfer Objects) ---

/**
* DTO for creating the core Website entity.
* Typically used internally or by admin functions.
*/
export interface CreateWebsiteDTO {
  url: string;
  interval?: number; // Optional initial globalInterval suggestion
}

/**
* DTO for adding a website TO A USER's dashboard.
* Contains the URL (to find/create the Website) and the user's specific settings.
* Fields match the optionality in the WebsiteUser schema model.
*/
export interface WebsiteUserDTO {
  url: string;                 // Required to identify the website
  name?: string | null;        // User's custom name (optional)
  interval?: number | null;    // User's preferred check interval (optional)
  alertThreshold?: number | null; // User's failure threshold for alerts (optional)
  alertEnabled?: boolean | null; // User wants alerts? (optional, defaults false in schema)
  notifyEmail?: string | null; // Specific email override (optional)
}

/**
* DTO for UPDATING a user's settings for a website they already monitor.
* Does NOT include URL. Contains only user-modifiable WebsiteUser fields.
*/
export interface WebsiteUpdateDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
}

// --- Frontend Specific Combined/ViewModel Types ---

/**
* Represents a WebsiteUser record JOINED with its corresponding Website record.
* This is the typical structure returned when fetching a user's monitored websites.
*/
export interface UserWebsite extends WebsiteUser {
  // Inherits all fields from WebsiteUser (Prisma type)
  // Includes the nested Website object from the relation/include query
  website: Website;
}

/**
* Data structure for the detailed view of a single website.
* Contains various pieces of information fetched for that specific page.
*/
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;                      // User's custom name or the URL
  url: string;
  latestResult: MonitoringResult | null; // The single most recent monitoring result
  chartData: MonitoringResult[];     // Results within the selected timeframe (time-sorted ASC for charts)
  recentChecks: MonitoringResult[];  // Limited list of recent results (sorted by user preference)
  uptimePercent: number;             // Calculated uptime for the selected timeframe
}

/**
* Represents the overall statistics summary for the user's dashboard.
*/
export interface OverallStats {
  totalWebsites: number;      // Total websites the user monitors
  activeWebsites?: number;     // Count of currently active websites (backend might not always provide)
  websiteStats: WebsiteStatsData[]; // Array of stats for each individual website
  overallUptime: number;      // Average uptime across user's sites for the period
  overallResponseTime: number; // Average response time across user's sites for the period
}


// --- Monitoring Service & API Response Types ---

/**
* Represents the raw outcome of a single website check performed by the monitoring service.
*/
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

/**
* Options for filtering API queries that retrieve lists of monitoring results.
*/
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
  websiteId?: number; // Optional: Filter by specific website
  userId?: number;    // Optional: Filter by specific user (for admin views)
}

/**
* Structure for aggregated statistics calculated for a single website over a defined period.
*/
export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;         // User's custom name or URL
  url: string;
  uptime: number;              // Uptime percentage (0-100)
  averageResponseTime: number; // Avg response time (ms) for successful checks
  totalChecks: number;         // Total checks performed in the period
  lastCheck: Date | string | null; // Timestamp of the most recent check (Date or ISO string)
  consecutiveFailures: number; // Current count of consecutive failed checks
}


// --- Alerting Types ---

/**
* Defines the allowed classifications for alert types.
*/
export type AlertType = 'down' | 'slow'; // Add more if needed (e.g., 'ssl_expiry')

/**
* Options for filtering API queries that retrieve lists of alerts.
*/
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;   // Filter by type ('down' or 'slow')
  from?: Date;
  to?: Date;
  isResolved?: boolean; // Filter by resolved status
  userId?: number;      // Filter alerts associated with a specific user
  websiteId?: number;   // Filter alerts for a specific website
}

/**
* Defines the necessary information for constructing and sending an email alert notification.
*/
export interface EmailAlertOptions {
  to: string;
  subject: string;
  body: string; // Often HTML content
}

/**
* Extended Prisma Alert type including nested Website information.
* Useful when displaying alert lists with context.
*/
export interface AlertWithWebsite extends Alert {
  website: {
      url: string;
      // Include user-specific name if the query fetches it via WebsiteUser relation
      websiteUsers?: { name?: string | null }[];
  };
}

/**
* Extended Prisma AlertUser type including the nested AlertWithWebsite.
* Represents a user's specific notification record for an alert.
*/
export interface AlertUserWithAlert extends AlertUser {
  alert: AlertWithWebsite;
}


// --- Authentication/User Types ---

/**
* Data required for the user registration API endpoint.
*/
export interface RegisterUserData {
  email: string;
  password: string;
  name?: string; // Optional display name
}

/**
* Credentials required for the user login API endpoint.
*/
export interface LoginCredentials {
  email: string;
  password: string;
}


// --- Utility Types ---

/**
* Defines the standard keys used for selecting timeframes in the UI and API requests.
*/
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';

// Note: Removed the duplicate/incorrect 'MonitoringResults' interface.
// Note: Removed basic 'CustomError' as 'ApiError' is more comprehensive.