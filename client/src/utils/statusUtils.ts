// src/utils/statusUtils.ts
import { AlertColor } from '@mui/material';
import { AlertType } from "../types";

/**
 * Determines a status color based on uptime percentage.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getStatusColor(
  uptime: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return 'default'; // Handle NaN as well
  // Clamp value for safety, although formatting already does this
  const clampedUptime = Math.max(0, Math.min(100, uptime));

  if (clampedUptime >= 99.9) return 'success'; // Excellent
  if (clampedUptime >= 99) return 'warning'; // Okay/Needs Attention
  // Removed the >= 95 check for error, as anything below 99 is warning or error
  if (clampedUptime < 99 && clampedUptime >= 95) return 'error'; // Poor (Adjust threshold if needed)
  if (clampedUptime < 95) return 'error'; // Very Poor / Down significantly
  return 'default'; // Should not be reached if logic is correct, but safe fallback
}

/**
 * Determines a status color based on response time in milliseconds.
 * @param time Response time in milliseconds. Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getResponseTimeColor(
  time: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (time === null || time === undefined || isNaN(time)) return 'default'; // Handle NaN
  if (time <= 500) return 'success';  // Fast
  if (time <= 1500) return 'warning'; // Acceptable
  return 'error';                   // Slow
}

/**
 * Determines a status color based on the type of alert.
 * Uses the AlertColor type from MUI for compatibility.
 * @param type The AlertType string ('down', 'slow', 'recovered', etc.).
 * @returns An MUI AlertColor ('success', 'warning', 'error', 'info').
 */
export function getAlertTypeColor(
  type: AlertType | string | undefined,
): AlertColor {
  switch (type?.toLowerCase()) {
    case 'down':
      return 'error';
    case 'slow':
      return 'warning';
    case 'recovered':
      return 'success';
     case 'ssl':
       return 'warning';
     case 'dns':
       return 'error';
    default:
      return 'info';
  }
}

/**
 * Formats response time (ms) into a human-readable string (e.g., "123 ms", "1.23 s").
 * @param ms Response time in milliseconds. Can be null or undefined.
 * @returns Formatted string or "N/A".
 */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms)) return "N/A";

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  } else {
    const seconds = ms / 1000;
    const decimals = seconds % 1 === 0 ? 0 : (seconds < 10 ? 2 : 1);
    return `${seconds.toFixed(decimals)} s`;
  }
}

/**
 * Formats uptime percentage for display (e.g., "99.95%", "100%").
 * Adds the '%' symbol.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Formatted string with '%' symbol or "N/A".
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return "N/A";

  const clampedUptime = Math.max(0, Math.min(100, uptime));

  // Show "100" without decimals, otherwise show 2 decimal places
  const formatted = clampedUptime === 100 ? "100" : clampedUptime.toFixed(2);
  // Return only the number part, the % sign is added in the Navbar component for clarity
  return formatted;
}


/**
 * Provides a simple human-readable status label ("Online", "Offline", "Unknown").
 * @param isAvailable Boolean indicating availability. Can be undefined.
 * @returns The status label string.
 */
export function getStatusLabel(isAvailable: boolean | undefined): string {
  if (isAvailable === undefined) return "Unknown";
  return isAvailable ? "Online" : "Offline";
}

/**
 * Provides a concise description for different alert types.
 * @param type The AlertType string.
 * @returns A human-readable description.
 */
export function getAlertTypeDescription(type: AlertType | string | undefined): string {
  switch (type?.toLowerCase()) {
    case 'down':
      return "Website is offline or unreachable.";
    case 'recovered':
      return "Website recovered and is back online.";
    case 'slow':
      return "Website response time exceeded threshold.";
    case 'ssl':
       return "SSL certificate issue detected.";
     case 'dns':
       return "DNS resolution problem detected.";
    default:
      return "An alert was triggered.";
  }
}