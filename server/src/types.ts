import { Website, MonitoringResult, Alert, User, WebsiteUser } from '@prisma/client';



export interface CreateWebsiteDTO {
  name: string;
  url: string;
  interval: number;
  isActive?: boolean;
  alertEnabled?: boolean;
  alertThreshold?: number;
  notifyEmail?: string;
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

export type AlertType = 'down' | 'recovered' | 'slow';

// Export Prisma types for easy access
export { Website, MonitoringResult, Alert, User, WebsiteUser };