import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  Alert as PrismaAlert,
  User as PrismaUser,
  WebsiteUser as PrismaWebsiteUser,
  Incident as PrismaIncident,
  Prisma,
} from "@prisma/client";

export type WebsitePrisma = PrismaWebsite;
export type MonitoringResultPrisma = PrismaMonitoringResult;
export type AlertPrisma = PrismaAlert;
export type UserPrisma = PrismaUser;
export type WebsiteUserPrisma = PrismaWebsiteUser;
export type IncidentPrisma = PrismaIncident;

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
    name?: string | null;
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

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface WebsiteUser {
  id: number;
  userId: string;
  websiteId: number;
  name: string | null;
  interval: number | null;
  alertEnabled: boolean;
  alertThreshold: number | null;
  notifyEmail: string | null;
  createdAt: string;
  isPinned: boolean;

  website?: Website;
  latestResult?: MonitoringResult | null;
  chartData?: ChartDataPoint[];
  uptimePercent?: number;
  currentIncident?: Incident | null;
}

export type AlertType = "down" | "slow";
export const VALID_ALERT_TYPES = ["down", "slow"] as const;

export interface Alert {
  id: number;
  websiteId: number;
  userId: string;
  type: AlertType;
  message: string;
  createdAt: string;
  incidentId?: number;

  website?: {
    id: number;
    url: string;
    name?: string | null;
  };
  user?: {
    id: string;
    name: string | null;
  };

  incident?: {
    id: number;
    startTime?: string;
    endTime?: string | null;
  };
}

export type IncidentType = "down" | "slow";
export const VALID_INCIDENT_TYPES = ["down", "slow"] as const;

export interface Incident {
  id: number;
  websiteId: number;
  type: IncidentType;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  initialResultId: number | null;
  confirmingResultId: number | null;
  resolvingResultId: number | null;

  website?: {
    id: number;
    url: string;
    name?: string | null;
  };
}

export type TimeframeKey = "hour" | "day" | "week" | "month" | "year";
export const VALID_TIMEFRAMES = [
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

export type MonitoringResultSortBy = keyof Pick<
  Prisma.MonitoringResultOrderByWithRelationInput,
  "checkedAt" | "isAvailable" | "responseTime" | "statusCode" | "id"
>;
export const VALID_SORT_BY = [
  "checkedAt",
  "isAvailable",
  "responseTime",
  "statusCode",
  "id",
] as const;

export type SortDirection = Prisma.SortOrder;
export const VALID_SORT_DIR = ["asc", "desc"] as const;

export type IncidentStatusFilter = "open" | "closed";
export const VALID_INCIDENT_STATUSES = ["open", "closed"] as const;

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

export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
  websiteId?: number;
  userId?: string;
}

export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;
  to?: Date;
  userId?: string;
  websiteId?: number;
}

export interface IncidentQueryOptions {
  limit?: number;
  type?: IncidentType;
  from?: Date;
  to?: Date;
  userId?: string;
  websiteId?: number;
  status?: IncidentStatusFilter;
}

export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface WebsiteStatsData {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  lastCheck: string | null;
  incidentCount: number;
  downIncidentCount: number;
  slowIncidentCount: number;
}

export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
  incidentsLast24h: number;
  lastIncidentTimestamp?: string | null;
  lastIncidentWebsiteId?: number | null;
}

export interface ChartDataPoint {
  label: string;
  timestamp: number;
  avgResponseTime: number | null;
  uptimeRatio: number;
  checkCount: number;
}

export interface WebsiteDetailsData {
  websiteId: number;
  name: string;
  url: string;
  latestResult: MonitoringResult | null;
  chartData: ChartDataPoint[];
  recentChecks: MonitoringResult[];
  uptimePercent: number;
  currentIncident?: Incident | null;
  recentIncidents?: Incident[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AlertStats {
  totalAlerts: number;
  byType: Partial<Record<AlertType, number>>;
  byWebsite: Array<{
    websiteId: number;
    websiteName: string;
    count: number;
  }>;
}
export interface IncidentCountResponse {
  incidentCount: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

export interface WebsiteIncidentInfo {
  websiteId: number;
  name: string | null;
  url: string;
}
