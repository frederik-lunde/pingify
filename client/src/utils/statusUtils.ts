// src/utils/statusUtils.ts
import { AlertColor } from '@mui/material'; // Ensure AlertColor is imported
import { AlertType } from "../types"; // Use types from central types file

/**
 * Determines a status color based on uptime percentage.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getStatusColor(
  uptime: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (uptime === null || uptime === undefined) return 'default'; // Unknown status
  if (uptime >= 99.9) return 'success'; // Excellent
  if (uptime >= 99) return 'warning'; // Okay/Needs Attention
  // Consider 0% uptime also an error? Or just very low?
  // if (uptime <= 0) return 'error'; // Explicitly handle 0 or negative if possible
  if (uptime >= 95) return 'error'; // Poor
  return 'error'; // Very Poor / Down significantly (Adjust threshold as needed)
}

/**
 * Determines a status color based on response time in milliseconds.
 * @param time Response time in milliseconds. Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getResponseTimeColor(
  time: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (time === null || time === undefined) return 'default'; // No response time data
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
  type: AlertType | string | undefined, // Allow potentially undefined or broader string
): AlertColor { // Return MUI AlertColor type
  switch (type?.toLowerCase()) { // Use optional chaining and handle potential undefined
    case 'down':
      return 'error';
    case 'slow':
      return 'warning';
    case 'recovered':
      return 'success';
     case 'ssl': // Added common alert types
       return 'warning';
     case 'dns':
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
    // Show milliseconds directly if under 1 second
    return `${Math.round(ms)} ms`;
  } else {
    // Show seconds with 1 or 2 decimal places if 1 second or more
    const seconds = ms / 1000;
    // Use fewer decimals for whole numbers or numbers close to whole
    const decimals = seconds % 1 === 0 ? 0 : (seconds < 10 ? 2 : 1);
    return `${seconds.toFixed(decimals)} s`;
  }
}

/**
 * Formats uptime percentage for display (e.g., "99.95%", "100%").
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Formatted string with '%' symbol or "N/A".
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return "N/A";

  // Clamp value between 0 and 100
  const clampedUptime = Math.max(0, Math.min(100, uptime));

  // Show "100%" without decimals, otherwise show 2 decimal places
  const formatted = clampedUptime === 100 ? "100" : clampedUptime.toFixed(2);
  return `${formatted}`;
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
      return "An alert was triggered."; // Generic fallback
  }
}