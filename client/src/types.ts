// Basic data types
export interface MonitoringResult {
  id: number;
  websiteId: number;
  checkedAt: string;
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  website?: {
    url: string;
    websiteUsers?: Array<{ name: string }>;
  };
}

// Core Website entity (without user-specific settings)
export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null;
  globalInterval: number;
  createdAt?: string;
  updatedAt?: string;
}

// Website with user-specific settings
export interface UserWebsite {
  id: number;
  userId: number;
  websiteId: number;
  name: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number | null;
  notifyEmail: string | null;
  createdAt: string;
  website: Website;
}

// DTOs for creating/updating websites
export interface WebsiteCreateDTO {
  url: string;
  name: string;
  interval: number;
  alertEnabled?: boolean;
  alertThreshold?: number | null;
  notifyEmail?: string | null;
}

export interface WebsiteUpdateDTO {
  name?: string;
  interval?: number;
  alertEnabled?: boolean;
  alertThreshold?: number | null;
  notifyEmail?: string | null;
}

// Stats types
export interface WebsiteStats {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number;
  totalChecks: number;
  lastCheck: string | null;
  consecutiveFailures: number;
}

export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStats[];
  overallUptime: number;
  overallResponseTime: number;
}

// Updated Alert types
export type AlertType = 'down' | 'slow';

export interface Alert {
  id: number;
  websiteId: number;
  type: AlertType;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  website?: {
    url: string;
    websiteUsers?: Array<{ name: string }>;
  };
}

// New interface for user-specific alert status
export interface AlertUser {
  id: number;
  userId: number;
  alertId: number;
  isRead: boolean;
  createdAt: string;
  alert: Alert;
}

export interface AlertStats {
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  byType: Record<AlertType, number>;
  byWebsite: Array<{ 
    websiteId: number, 
    websiteName: string, 
    count: number 
  }>;
}

export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;
  to?: Date;
  isResolved?: boolean;
}

export interface EmailAlertOptions {
  to: string;
  subject: string;
  body: string;
}

// User types
export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}