import { Website, MonitoringResult, Alert } from '@prisma/client';

// Request body types
export interface CreateWebsiteBody {
  name: string;
  url: string;
  interval: number;
  isActive: boolean;
  alertEnabled?: boolean;
  alertThreshold?: number;
  notifyEmail?: string;
}

export interface UpdateWebsiteBody {
  name?: string;
  url?: string;
  interval?: number;
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

// Export Prisma types for easy access
export { Website, MonitoringResult, Alert };