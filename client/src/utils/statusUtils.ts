// src/utils/statusUtils.ts
import { AlertColor } from '@mui/material';
// --- Import date-fns for downtime formatting ---
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { AlertType } from "../types"; // Ensure this path is correct

/**
 * Determines a status color based on uptime percentage.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getStatusColor(
  uptime: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return 'default'; // Handle NaN as well
  // Clamp value for safety
  const clampedUptime = Math.max(0, Math.min(100, uptime));

  if (clampedUptime >= 99.9) return 'success'; // Excellent
  if (clampedUptime >= 99) return 'warning'; // Okay/Needs Attention
  // Error threshold adjusted
  if (clampedUptime < 99 && clampedUptime >= 95) return 'error'; // Poor
  if (clampedUptime < 95) return 'error'; // Very Poor / Down significantly
  return 'default'; // Fallback
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
 * @param type The AlertType string ('down', 'slow', etc.).
 * @returns An MUI AlertColor ('success', 'warning', 'error', 'info').
 */
export function getAlertTypeColor(
  type: AlertType | string | undefined,
): AlertColor {
  // Added more potential types based on your example
  switch (type?.toLowerCase()) {
    case 'down':
      return 'error';
    case 'slow':
      return 'warning';
    case 'recovered':
      return 'success';
     case 'ssl': // Example added type
       return 'warning';
     case 'dns': // Example added type
       return 'error';
    default:
      return 'info'; // Default for unknown or other types
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
    // Adjust decimals based on value
    const decimals = seconds % 1 === 0 ? 0 : (seconds < 10 ? 2 : 1);
    return `${seconds.toFixed(decimals)} s`;
  }
}

/**
 * Formats uptime percentage for display (e.g., "99.95", "100").
 * NOTE: Returns only the number string, WITHOUT the '%' symbol.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Formatted number string or "N/A".
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return "N/A";

  const clampedUptime = Math.max(0, Math.min(100, uptime));

  // Show "100" without decimals, otherwise show 2 decimal places
  const formatted = clampedUptime === 100 ? "100" : clampedUptime.toFixed(2);
  return formatted; // Return only the number part
}

/**
 * Formats the time elapsed since a given ISO date string for downtime display.
 * Example: "Down for 2 hours", "Down for 5 minutes"
 * @param isoDateString The ISO 8601 string from the API.
 * @returns Formatted duration string or null.
 */
export const formatDowntimeDuration = (isoDateString: string | null | undefined): string | null => {
    if (!isoDateString) {
        return null;
    }
    try {
        const date = parseISO(isoDateString);
        // formatDistanceToNowStrict provides "x units" output
        const duration = formatDistanceToNowStrict(date);
        // Construct the display string
        return `Down for ${duration}`;
    } catch (e) {
        // Log error during parsing
        console.error("Error parsing downtime date:", isoDateString, e);
        // Provide a fallback message
        return "Down (time unavailable)";
    }
};


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
  // Added more potential types based on your example
  switch (type?.toLowerCase()) {
    case 'down':
      return "Website is offline or unreachable.";
    case 'recovered':
      return "Website recovered and is back online.";
    case 'slow':
      return "Website response time exceeded threshold.";
    case 'ssl': // Example added type
       return "SSL certificate issue detected.";
     case 'dns': // Example added type
       return "DNS resolution problem detected.";
    default:
      return "An alert was triggered."; // Generic default
  }
}