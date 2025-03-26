import { Website, MonitoringResult, Alert, User, WebsiteUser, AlertUser } from '@prisma/client';

// Website-related DTOs
export interface CreateWebsiteDTO {
  url: string;
  interval?: number; // Optional, used for initial globalInterval
}

export interface WebsiteUserDTO {
  url: string;
  name: string;
  interval: number;
  alertThreshold?: number | null;
  alertEnabled?: boolean;
  notifyEmail?: string | null;
}

// Service response types
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
}

export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number;
  totalChecks: number;
  lastCheck: Date | null;
  consecutiveFailures: number;
}

export interface AlertQueryOptions {
  limit?: number;
  type?: string;
  from?: Date;
  to?: Date;
  isResolved?: boolean;
}

export interface EmailAlertOptions {
  to: string;
  subject: string;
  body: string;
}

export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CustomError extends Error {
  status?: number;
}

export type AlertType = 'down' | 'slow';

// Alert-related extended interfaces
export interface AlertWithWebsite extends Alert {
  website: {
    url: string;
    websiteUsers?: {
      name: string;
    }[];
  };
}

export interface AlertUserWithAlert extends AlertUser {
  alert: AlertWithWebsite;
}

// Export Prisma types for easy access
export { Website, MonitoringResult, Alert, User, WebsiteUser, AlertUser };