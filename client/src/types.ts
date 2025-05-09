/**
 * Defines keys for standard timeframes used in data fetching.
 */
export type TimeframeKey = 'hour' | 'day' | 'week' | 'month' | 'year';
/**
 * Array of valid timeframe keys.
 */
export const VALID_TIMEFRAMES = ['hour', 'day', 'week', 'month', 'year'] as const;

/**
 * Defines the type of an incident (e.g., website down or slow).
 */
export type IncidentType = 'down' | 'slow';
/**
 * Array of valid incident types.
 */
export const VALID_INCIDENT_TYPES = ['down', 'slow'] as const;

/**
 * Defines the type of an alert (e.g., website down or slow).
 */
export type AlertType = 'down' | 'slow';
/**
 * Array of valid alert types.
 */
export const VALID_ALERT_TYPES = ['down', 'slow'] as const;

/**
 * Defines filter options for incident status (open or closed).
 */
export type IncidentStatusFilter = 'open' | 'closed';
/**
 * Array of valid incident status filter values.
 */
export const VALID_INCIDENT_STATUSES = ['open', 'closed'] as const;

/**
 * Defines the fields by which monitoring results can be sorted.
 */
export type MonitoringResultSortBy = 'checkedAt' | 'isAvailable' | 'responseTime' | 'statusCode' | 'id';
/**
 * Array of valid fields for sorting monitoring results.
 */
export const VALID_SORT_BY: MonitoringResultSortBy[] = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'];

/**
 * Defines the direction for sorting (ascending or descending).
 */
export type SortDirection = 'asc' | 'desc';
/**
 * Array of valid sort directions.
 */
export const VALID_SORT_DIR: SortDirection[] = ['asc', 'desc'];

/**
 * Predefined sort options for website lists.
 */
export const SORT_OPTIONS = ['name-asc', 'name-desc', 'response-asc', 'response-desc'] as const;
/**
 * Represents a specific sort option from the predefined list.
 */
export type SortOption = typeof SORT_OPTIONS[number];

/**
 * Represents a single monitoring check result for a website.
 */
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

/**
 * Represents a globally defined website in the system.
 */
export interface Website {
  id: number;
  url: string;
  isActive: boolean;
  lastChecked: string | null;
  globalInterval: number;
  createdAt?: string;
  updatedAt?: string;
  name?: string | null;
}

/**
 * Represents a user account in the system.
 */
export interface User {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Represents a monitoring incident (e.g., downtime or slow period).
 */
export interface Incident {
    id: number;
    websiteId: number;
    type: IncidentType;
    startTime: string;
    endTime: string | null;
    durationSeconds: number | null;
    initialResultId?: number | null;
    confirmingResultId?: number | null;
    resolvingResultId?: number | null;
    website?: {
        id: number;
        url: string;
        name?: string | null;
    };
}

/**
 * Represents a user's specific website configuration and associated data.
 */
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
  uptimePercent?: number | null
  currentIncident?: Incident | null;
}

/**
 * Represents an alert notification sent to a user.
 */
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
    }
    incident?: {
        id: number;
        startTime?: string;
        endTime?: string | null;
    }
}

/**
 * Data Transfer Object for adding a new website for a user.
 */
export interface AddWebsiteUserDTO {
  url: string;
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

/**
 * Data Transfer Object for updating a user's website settings.
 */
export interface UpdateWebsiteUserDTO {
  name?: string | null;
  interval?: number | null;
  alertThreshold?: number | null;
  alertEnabled?: boolean | null;
  notifyEmail?: string | null;
  isPinned?: boolean;
}

/**
 * Data Transfer Object for setting the pin status of a website.
 */
export interface SetPinStatusDTO {
    isPinned: boolean;
}

/**
 * Represents user credentials for login.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Represents data required for user registration.
 */
export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Data Transfer Object for updating user profile information.
 */
export interface UpdateUserProfileDTO {
    name?: string;
    email?: string;
}

/**
 * Data Transfer Object for updating a user's password.
 */
export interface UpdateUserPasswordDTO {
    currentPassword?: string;
    newPassword?: string;
}

/**
 * Defines query options for fetching monitoring results.
 */
export interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
  websiteId?: number;
}

/**
 * Defines query options for fetching alerts.
 */
export interface AlertQueryOptions {
  limit?: number;
  type?: AlertType;
  from?: Date;
  to?: Date;
  websiteId?: number;
}

/**
 * Defines query options for fetching incidents.
 */
export interface IncidentQueryOptions {
    limit?: number;
    type?: IncidentType;
    from?: Date;
    to?: Date;
    websiteId?: number;
    status?: IncidentStatusFilter;
}

/**
 * Represents the response of a single monitoring check.
 */
export interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

/**
 * Represents statistics for a single website.
 */
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

/**
 * Represents overall monitoring statistics for a user.
 */
export interface OverallStats {
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStatsData[];
  overallUptime: number;
  overallResponseTime: number | null;
  incidentsLast24h: number;
  lastIncidentTimestamp: string | null;
  lastIncidentWebsiteId?: number | null;
}

/**
 * Represents a data point used in charts (e.g., uptime, response time).
 */
export interface ChartDataPoint {
    label: string;
    timestamp: number;
    avgResponseTime: number | null;
    uptimeRatio: number;
    checkCount: number;
}

/**
 * Represents detailed data for a specific website, including charts and recent activity.
 */
export interface WebsiteDetailsData {
  websiteId: number;
  name: string;
  url: string;
  latestResult: MonitoringResult | null;
  chartData: ChartDataPoint[];
  recentChecks: MonitoringResult[];
  uptimePercent: number;
  currentIncident: Incident | null;
  recentIncidents: Incident[];
}

/**
 * Represents the response from a successful authentication request.
 */
export interface AuthResponse {
    token: string;
    user: User;
}

/**
 * Represents statistics related to alerts.
 */
export interface AlertStats {
  totalAlerts: number;
  byType: Partial<Record<AlertType, number>>;
  byWebsite: Array<{
    websiteId: number;
    websiteName: string;
    count: number;
  }>;
}

/**
 * Represents a response containing an incident count.
 */
export interface IncidentCountResponse {
  incidentCount: number;
}

/**
 * Defines the shape of the authentication context.
 */
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

/**
 * Represents a summary of website data, typically for dashboard display.
 */
export interface WebsiteDataSummary {
    websiteCards: WebsiteUser[];
    overallStats: OverallStats | null;
    isLoading: boolean;
    isFetching: boolean;
    error: ApiError | null;
    refetch: () => Promise<unknown>;
    totalWebsitesCount: number;
    upWebsitesCount: number;
    incidentsLast24h: number | null;
    lastIncidentTimestamp: string | null | undefined;
    lastIncidentWebsiteId: number | null | undefined;
}

/**
 * Represents a custom API error, extending the base Error class.
 */
export interface ApiError extends Error {
  name: string;
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: unknown;
  isAuthError?: boolean;
  isNetworkError?: boolean;
}