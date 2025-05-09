import { AlertColor } from '@mui/material';
import { formatDistanceToNowStrict, parseISO, formatDistanceStrict } from 'date-fns';
import { AlertType, Incident } from "../types";

/**
 * Determines a status color based on uptime percentage.
 */
export function getStatusColor(
  uptime: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return 'default';
  const clampedUptime = Math.max(0, Math.min(100, uptime));
  if (clampedUptime >= 99.9) return 'success';
  if (clampedUptime >= 99.0) return 'warning';
  if (clampedUptime < 99.0) return 'error';
  return 'default';
}

/**
 * Determines a status color based on response time.
 */
export function getResponseTimeColor(
  time: number | null | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (time === null || time === undefined || isNaN(time)) return 'default';
  if (time <= 1500) return 'success';
  if (time <= 3000) return 'warning';
  return 'error';
}

/**
 * Gets the MUI AlertColor corresponding to an alert type.
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
      return 'info';
  }
}

/**
 * Formats response time in milliseconds to a string.
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
 * Formats uptime percentage to a string.
 */
export function formatUptime(uptime: number | null | undefined): string {
  if (uptime === null || uptime === undefined || isNaN(uptime)) return "N/A";
  const clampedUptime = Math.max(0, Math.min(100, uptime));
  const formatted = clampedUptime === 100 ? "100" : clampedUptime.toFixed(2);
  return formatted;
}

/**
 * Formats the duration of an incident or time since it started.
 */
export const formatIncidentDuration = (incident: Incident | null | undefined): string | null => {
    if (!incident) {
        return null;
    }
    try {
        const startDate = parseISO(incident.startTime);
        if (incident.endTime) {
            const endDate = parseISO(incident.endTime);
            let durationString: string;
            if (incident.durationSeconds !== null && incident.durationSeconds !== undefined && incident.durationSeconds >= 0) {
                 durationString = formatSeconds(incident.durationSeconds);
            } else {
                 durationString = formatDistanceStrict(endDate, startDate);
            }
            return `for ${durationString}`;
        } else {
            const timeSince = formatDistanceToNowStrict(startDate, { addSuffix: true });
            return `since ${timeSince}`;
        }
    } catch (e) {
        console.error("Error parsing incident dates:", incident, e);
        return "duration unavailable";
    }
};

/**
 * Formats a duration in seconds into a string (d, h, m, s).
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
    if (seconds > 0 || parts.length === 0 || (days === 0 && hours === 0 && minutes === 0)) {
        parts.push(`${seconds}s`);
    }
    return parts.join(' ') || '0s';
}

/**
 * Determines the display status label for a website.
 */
export function getWebsiteStatusLabel(
    incident: Incident | null | undefined,
    isAvailable: boolean | null | undefined
): "Online" | "Offline" | "Slow" | "Pending" {
    if (incident) {
        if (incident.type === 'down') return "Offline";
        if (incident.type === 'slow') return "Slow";
    }
    if (isAvailable === true) return "Online";
    if (isAvailable === false) return "Offline";
    return "Pending";
}

/**
 * Provides a description for an alert type.
 */
export function getAlertTypeDescription(type: AlertType | string | undefined): string {
  switch (type?.toLowerCase()) {
    case 'down':
      return "Website is offline or unreachable.";
    case 'slow':
      return "Website response time exceeded threshold.";
    default:
      return "An alert was triggered.";
  }
}