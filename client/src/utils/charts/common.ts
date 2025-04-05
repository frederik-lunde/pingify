// src/utils/charts/common.ts
import { MonitoringResult, TimeframeKey } from "../../types"; // Use TimeframeKey

/**
 * Calculates the start date based on a timeframe key relative to a given end date (usually now).
 * @param timeframe The selected timeframe key ('hour', 'day', 'week', 'month', 'year').
 * @param endDate The date to calculate backwards from (defaults to current time).
 * @returns The calculated start Date. Returns epoch start (1970) for 'all' or invalid keys.
 */
export function getStartDateFromTimeframe(timeframe: TimeframeKey | string, endDate: Date = new Date()): Date {
  const startDate = new Date(endDate); // Start calculation from the end date

  switch (timeframe) {
    case 'hour':
      startDate.setHours(startDate.getHours() - 1);
      break;
    case 'day':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    // Handle explicit day counts if needed, mirroring logic from previous version
    case '1d': startDate.setDate(startDate.getDate() - 1); break;
    case '7d': startDate.setDate(startDate.getDate() - 7); break;
    case '30d': startDate.setDate(startDate.getDate() - 30); break;
    case '365d': startDate.setDate(startDate.getDate() - 365); break;
    case 'all': // Represent 'all' with a very early date
      return new Date(0); // Epoch start
    default:
      console.warn(`Invalid timeframe key: "${timeframe}". Defaulting to 'day'.`);
      startDate.setDate(startDate.getDate() - 1); // Default to 'day' if invalid
      break; // Added break statement
  }

  return startDate;
}

/**
 * Filters monitoring results to include only those within a specified timeframe.
 * @param results Array of monitoring results.
 * @param timeframe The selected timeframe key.
 * @returns Filtered results within the specified timeframe.
 */
export function filterResultsByTimeRange(
  results: MonitoringResult[],
  timeframe: TimeframeKey | string,
): MonitoringResult[] {
  // Return early if no results or timeframe requires all data
  if (!results || results.length === 0 || timeframe === 'all') {
      return results;
  }

  // Calculate the start date based on the timeframe
  const startDate = getStartDateFromTimeframe(timeframe);

  // Filter results where checkedAt is on or after the calculated start date
  return results.filter((result) => {
    // Ensure result.checkedAt is valid before creating Date
    if (!result?.checkedAt) return false;
    try {
       const checkedAtDate = new Date(result.checkedAt);
       // Check if the date is valid before comparison
       return !isNaN(checkedAtDate.getTime()) && checkedAtDate >= startDate;
    } catch (e) {
        console.error(`Error parsing date: ${result.checkedAt}`, e);
        return false; // Exclude results with invalid dates
    }
  });
}


/**
 * Sorts monitoring results by time (chronologically, oldest first).
 * @param results Array of monitoring results.
 * @returns A new array with results sorted by time.
 */
export function sortResultsByTime(
  results: MonitoringResult[],
): MonitoringResult[] {
  if (!results || results.length === 0) return [];

  // Create a new array before sorting to avoid mutating the original
  return [...results].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
  );
}

/** Type definition for grouped time data */
export interface GroupedResult {
    period: string; // The label for the time period (e.g., 'YYYY-MM-DD HH:00')
    total: number; // Total checks in this period
    available: number; // Number of 'up' checks
    unavailable: number; // Number of 'down' checks
    uptimePercentage: number; // Uptime percentage for this period
    averageResponseTime: number; // Average response time for available checks (ms)
}

/** Type definition for the aggregation map used internally */
type GroupedDataMap = Map<string, {
    total: number;
    available: number;
    responseTimesSum: number; // Sum of response times for averaging
    responseTimeCount: number; // Count of valid response times
}>;

/**
 * Groups monitoring results by a specified time granularity (hour, day, week, month).
 * @param results Array of monitoring results to group.
 * @param groupBy The time unit to group by. Defaults to 'day'.
 * @returns An array of grouped results, sorted chronologically by period.
 */
export function groupResultsByTime(
  results: MonitoringResult[],
  groupBy: "hour" | "day" | "week" | "month" = "day",
): GroupedResult[] {
  if (!results || results.length === 0) return [];

  const groupedData: GroupedDataMap = new Map();

  // Helper function to get the period key based on granularity
  const getPeriodKey = (date: Date): string => {
    switch (groupBy) {
      case "hour":
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      case "week":
        // Calculate the start of the week (assuming Sunday is the first day)
        { const firstDayOfWeek = new Date(date);
        firstDayOfWeek.setDate(date.getDate() - date.getDay());
        firstDayOfWeek.setHours(0, 0, 0, 0); // Normalize time
        return `${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfWeek.getDate()).padStart(2, '0')}`; } // Key is start date of the week
      case "month":
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // Key is YYYY-MM
      case "day":
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; // Key is YYYY-MM-DD
    }
  };

  // Iterate through results and aggregate data
  results.forEach((result) => {
    const date = new Date(result.checkedAt);
    // Skip invalid dates
    if (isNaN(date.getTime())) {
        console.warn(`Skipping result with invalid date: ${result.checkedAt}`);
        return;
    }

    const period = getPeriodKey(date);

    // Initialize group if it doesn't exist
    if (!groupedData.has(period)) {
      groupedData.set(period, {
        total: 0,
        available: 0,
        responseTimesSum: 0,
        responseTimeCount: 0,
      });
    }

    // Update group data
    const group = groupedData.get(period)!;
    group.total++;
    if (result.isAvailable) {
      group.available++;
      if (result.responseTime != null) { // Check for null or undefined
        group.responseTimesSum += result.responseTime;
        group.responseTimeCount++;
      }
    }
  });

  // Convert map to array, calculate percentages/averages, and sort
  return Array.from(groupedData.entries())
    .map(([period, data]): GroupedResult => { // Explicit return type
      const uptimePercentage = data.total > 0 ? (data.available / data.total) * 100 : 0;
      const averageResponseTime = data.responseTimeCount > 0 ? data.responseTimesSum / data.responseTimeCount : 0;
      const unavailable = data.total - data.available; // Calculate unavailable count

      return {
        period,
        total: data.total,
        available: data.available,
        unavailable, // Include unavailable count
        uptimePercentage,
        averageResponseTime,
      };
    })
    // Sort the final array chronologically by period string
    .sort((a, b) => a.period.localeCompare(b.period));
}


/**
 * Formats a date for display in charts, adjusting based on the overall timeframe.
 * @param date The Date object to format.
 * @param timeframe The selected timeframe key ('hour', 'day', 'week', 'month', 'year').
 * @returns A formatted date string suitable for chart labels.
 */
export function formatDateForTimeRange(
  date: Date,
  timeframe: TimeframeKey | string,
): string {
   try {
     switch (timeframe) {
        case 'hour':
            // HH:MM format for hourly view
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        case 'day':
        case '1d':
            // HH:MM or just Hour for daily view
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
        case 'week':
        case '7d':
            // Short weekday and day for weekly view
            return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
        case 'month':
        case '30d':
            // Month abbreviation and day for monthly view
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        case 'year':
        case '365d':
            // Month abbreviation for yearly view
            return date.toLocaleDateString([], { month: 'short' });
        case 'all':
             // Month and Year for 'all time' view
             return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
        default:
            // Fallback to a default locale string
            return date.toLocaleString();
     }
   } catch (e) {
       console.error("Error formatting date:", date, e);
       return "Invalid Date"; // Return placeholder on error
   }
}

// Note: getGradientColor function is removed as it wasn't used in the provided hooks/components
// and introduces complexity. Direct color mapping (like in statusUtils) is often preferred.