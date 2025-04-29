/* src/utils/statusUtils.ts */
import { AlertColor } from '@mui/material';
import { formatDistanceToNowStrict, parseISO, formatDistanceStrict } from 'date-fns'; // Added differenceInSeconds, formatDistanceStrict
import { AlertType, Incident } from "../types"; // Ensure this path is correct, Added Incident

/**
 * Determines a status color based on uptime percentage.
 * Includes 'success', 'warning', and 'error' states.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getStatusColor(
  uptime: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return 'default';
  const clampedUptime = Math.max(0, Math.min(100, uptime));

  // --- MODIFICATION: Define thresholds for success, warning, error ---
  if (clampedUptime >= 99.9) return 'success'; // e.g., 99.9% and above is great
  if (clampedUptime >= 99.0) return 'warning'; // e.g., 99.0% to 99.89% is okay/warning
  if (clampedUptime < 99.0) return 'error';   // e.g., Below 99.0% is poor/error
  // --- END MODIFICATION ---

  return 'default'; // Should not be reached with the logic above
}

/**
 * Determines a status color based on response time in milliseconds.
 * @param time Response time in milliseconds. Can be null or undefined.
 * @returns Material UI color key ('success', 'warning', 'error') or 'default'.
 */
export function getResponseTimeColor(
  time: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (time === null || time === undefined || isNaN(time)) return 'default';
  if (time <= 500) return 'success';  // Fast
  if (time <= 1500) return 'warning'; // Acceptable
  return 'error';                   // Slow
}

/**
 * Determines a status color based on the type of alert.
 * Uses the AlertColor type from MUI for compatibility.
 * @param type The AlertType string ('down', 'slow').
 * @returns An MUI AlertColor ('error', 'warning', 'info').
 */
export function getAlertTypeColor(
  type: AlertType | string | undefined,
): AlertColor {
  switch (type?.toLowerCase()) {
    case 'down':
      return 'error';
    case 'slow':
      return 'warning';
    default:
      return 'info'; // Default for unknown types
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
 * Formats uptime percentage for display (e.g., "99.95", "100").
 * Returns only the number string, WITHOUT the '%' symbol.
 * @param uptime Uptime percentage (0-100). Can be null or undefined.
 * @returns Formatted number string or "N/A".
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return "N/A";
  const clampedUptime = Math.max(0, Math.min(100, uptime));
  const formatted = clampedUptime === 100 ? "100" : clampedUptime.toFixed(2);
  return formatted;
}

/**
 * Formats the duration of an incident (if ended) or the time elapsed since it started (if ongoing).
 * @param incident The Incident object.
 * @returns Formatted duration string (e.g., "for 2 hours", "since 5 minutes ago") or null.
 */
export const formatIncidentDuration = (incident: Incident | null | undefined): string | null => {
    if (!incident) {
        return null;
    }
    try {
        const startDate = parseISO(incident.startTime);
        if (incident.endTime) {
            // Incident has ended, format the fixed duration
            const endDate = parseISO(incident.endTime);

            // Use provided durationSeconds if available and valid, otherwise calculate
            let durationString: string;
            if (incident.durationSeconds !== null && incident.durationSeconds !== undefined && incident.durationSeconds >= 0) {
                 durationString = formatSeconds(incident.durationSeconds);
            } else {
                 // Calculate using date-fns as a fallback or primary method
                 durationString = formatDistanceStrict(endDate, startDate);
                 // Alternatively, use manual seconds calculation:
                 // const calculatedSeconds = differenceInSeconds(endDate, startDate);
                 // durationString = formatSeconds(calculatedSeconds);
            }
            return `for ${durationString}`;

        } else {
            // Incident is ongoing, format time since start
            const timeSince = formatDistanceToNowStrict(startDate, { addSuffix: true });
            return `since ${timeSince}`;
        }
    } catch (e) {
        console.error("Error parsing incident dates:", incident, e);
        return "duration unavailable";
    }
};

/**
 * Helper function to format seconds into a human-readable duration string.
 * (e.g., 125 -> "2m 5s", 3700 -> "1h 1m 40s") - Adjust formatting as desired.
 */
function formatSeconds(totalSeconds: number): string {
    if (totalSeconds < 0) totalSeconds = 0;

    const days = Math.floor(totalSeconds / (3600 * 24));
    totalSeconds %= (3600 * 24);
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    // Include seconds if it's the only unit, or if there are other units and seconds > 0,
    // or if the total duration is less than a minute.
    if (seconds > 0 || parts.length === 0 || (days === 0 && hours === 0 && minutes === 0)) {
        parts.push(`${seconds}s`);
    }

    return parts.join(' ') || '0s'; // Return '0s' if totalSeconds is 0
}


/**
 * Provides a simple human-readable status label based on incident or result.
 * @param incident The current incident (if any).
 * @param isAvailable Boolean indicating availability from latestResult (used as fallback).
 * @returns The status label string ("Online", "Offline", "Slow", "Pending").
 */
export function getWebsiteStatusLabel(
    incident: Incident | null | undefined,
    isAvailable: boolean | null | undefined
): "Online" | "Offline" | "Slow" | "Pending" {
    if (incident) {
        if (incident.type === 'down') return "Offline";
        if (incident.type === 'slow') return "Slow";
    }
    // If no incident, rely on latest result
    if (isAvailable === true) return "Online";
    if (isAvailable === false) return "Offline"; // Explicitly offline from result
    return "Pending"; // No incident and no result yet
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
    case 'slow':
      return "Website response time exceeded threshold.";
    default:
      return "An alert was triggered."; // Generic default
  }
}