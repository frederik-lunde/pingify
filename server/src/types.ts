// types.ts - Type definitions
export interface Website {
    id: number;
    name: string;
    url: string;
    isActive: boolean;
    alertEnabled: boolean;
    alertThreshold: number;
    notifyEmail: string | null;
    interval: number | null;
    lastChecked: Date | null;
  }
  
  export interface MonitoringResult {
    id: number;
    websiteId: number;
    checkedAt: Date;
    responseTime: number | null;
    isAvailable: boolean;
    statusCode: number | null;
    errorMessage: string | null;
  }
  
  export interface Alert {
    id: number;
    websiteId: number;
    createdAt: Date;
    type: string;
    message: string;
  }

export interface CreateWebsiteBody {
  name: string;
  url: string;
  interval: number;
  isActive: boolean;
}