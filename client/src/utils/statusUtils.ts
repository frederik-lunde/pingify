// src/utils/statusUtils.ts
import { AlertType } from '../types';

/**
 * Get color based on uptime percentage
 * @param uptime Uptime percentage (0-100)
 * @returns Material UI color identifier
 */
export function getStatusColor(uptime: number): 'success' | 'warning' | 'error' | 'default' {
  if (uptime >= 99.9) return 'success';
  if (uptime >= 95) return 'warning';
  if (uptime > 0) return 'error';
  return 'default'; // For cases where uptime is not available or zero
}

/**
 * Get color based on response time in milliseconds
 * @param time Response time in milliseconds
 * @returns Material UI color identifier
 */
export function getResponseTimeColor(time: number): 'success' | 'warning' | 'error' | 'default' {
  if (time === null || time === undefined) return 'default';
  if (time < 300) return 'success';
  if (time < 1000) return 'warning';
  return 'error';
}

/**
 * Get color based on alert type
 * @param type Alert type string (down, recovered, slow)
 * @returns Material UI color identifier
 */
export function getAlertTypeColor(type: string): 'success' | 'warning' | 'error' | 'info' {
  switch (type.toLowerCase() as AlertType) {
    case 'down':
      return 'error';
    case 'recovered':
      return 'success';
    case 'slow':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Format response time with appropriate units
 * @param ms Response time in milliseconds (can be null or undefined)
 * @returns Formatted string with appropriate units
 */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return 'N/A';
  
  if (ms < 1000) {
    return `${ms}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Format uptime percentage with consistent decimal places
 * @param uptime Uptime percentage (0-100)
 * @returns Formatted uptime string with % symbol
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined) return 'N/A';
  return `${uptime.toFixed(2)}%`;
}

/**
 * Get a human-readable status label
 * @param isAvailable Boolean indicating if the website is available
 * @returns Status label string
 */
export function getStatusLabel(isAvailable: boolean | undefined): string {
  if (isAvailable === undefined) return 'Unknown';
  return isAvailable ? 'Online' : 'Offline';
}

/**
 * Get a descriptive message for alert types
 * @param type Alert type
 * @returns Human-readable description of the alert type
 */
export function getAlertTypeDescription(type: string): string {
  switch (type.toLowerCase() as AlertType) {
    case 'down':
      return 'Website is down or unreachable';
    case 'recovered':
      return 'Website has recovered and is now online';
    case 'slow':
      return 'Website is responding slower than expected';
    default:
      return 'Unknown alert type';
  }
}