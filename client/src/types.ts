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

// Alert type
export interface Alert {
  id: number;
  websiteId: number;
  type: string;
  message: string;
  createdAt: string;
  website?: {
    url: string;
    websiteUsers?: Array<{ name: string }>;
  };
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