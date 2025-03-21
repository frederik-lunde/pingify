export interface MonitoringResult {
    id: number;
    websiteId: number;
    checkedAt: string;
    responseTime: number | null;
    isAvailable: boolean;
    statusCode: number | null;
    errorMessage: string | null;
  }
  
  export interface Website {
    id: number;
    name: string;
    url: string;
    isActive: boolean;
    lastChecked: string | null;
    interval: number;
    alertEnabled: boolean;
    alertThreshold: number | null;
    notifyEmail: string | null;
  }
  
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
  
  export interface Alert {
    id: number;
    websiteId: number;
    type: string;
    message: string;
    createdAt: string;
    website?: {
      name: string;
      url: string;
    };
  }

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