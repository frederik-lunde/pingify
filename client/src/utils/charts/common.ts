// src/utils/charts/common.ts
import { Theme } from '@mui/material';
import { MonitoringResult } from '../../types';
import { TimeRange } from '../../components/website-details/TimeRangeSelector';

/**
 * Get date range based on time range selection
 * @param timeRange Selected time range
 * @returns Object with from and to dates
 */
export function getDateRangeFromTimeRange(timeRange: TimeRange): { from: Date, to: Date } {
  const to = new Date();
  let from = new Date();
  
  switch (timeRange) {
    case '1d':
      from.setDate(from.getDate() - 1);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '365d':
      from.setDate(from.getDate() - 365);
      break;
    case 'all':
      // Set to a very old date for "all time"
      from = new Date(0);
      break;
  }
  
  return { from, to };
}

/**
 * Filters monitoring results based on time range
 * @param results Array of monitoring results
 * @param timeRange Selected time range
 * @returns Filtered results within the specified time range
 */
export function filterResultsByTimeRange(
  results: MonitoringResult[], 
  timeRange: TimeRange
): MonitoringResult[] {
  if (!results || results.length === 0) return [];
  
  const { from } = getDateRangeFromTimeRange(timeRange);
  
  return results.filter(result => {
    const checkedAt = new Date(result.checkedAt);
    return checkedAt >= from;
  });
}

/**
 * Sorts monitoring results by time (oldest first)
 * @param results Array of monitoring results
 * @returns Sorted array
 */
export function sortResultsByTime(results: MonitoringResult[]): MonitoringResult[] {
  if (!results || results.length === 0) return [];
  
  return [...results].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  );
}

/**
 * Group monitoring results by a time period
 * @param results Array of monitoring results
 * @param groupBy Time period to group by ('hour', 'day', 'week', 'month')
 * @returns Grouped results with counts and availability percentages
 */
export function groupResultsByTime(
  results: MonitoringResult[],
  groupBy: 'hour' | 'day' | 'week' | 'month' = 'day'
): Array<{
  period: string;
  total: number;
  available: number;
  unavailable: number;
  uptimePercentage: number;
  averageResponseTime: number;
}> {
  if (!results || results.length === 0) return [];
  
  const groupedData = new Map<string, {
    total: number;
    available: number;
    unavailable: number;
    responseTimes: number[];
  }>();
  
  // Group the results
  results.forEach(result => {
    const date = new Date(result.checkedAt);
    let period: string;
    
    switch (groupBy) {
      case 'hour':
        // Format: "YYYY-MM-DD HH:00"
        period = `${date.toISOString().split('T')[0]} ${date.getHours()}:00`;
        break;
      case 'day':
        // Format: "YYYY-MM-DD"
        period = date.toISOString().split('T')[0];
        break;
      case 'week':
        // Get the first day of the week (Sunday)
        const firstDay = new Date(date);
        const day = date.getDay();
        firstDay.setDate(date.getDate() - day);
        period = firstDay.toISOString().split('T')[0];
        break;
      case 'month':
        // Format: "YYYY-MM"
        period = date.toISOString().split('T')[0].substring(0, 7);
        break;
      default:
        // Default to day format
        period = date.toISOString().split('T')[0];
    }
    
    // Initialize or update the group
    if (!groupedData.has(period)) {
      groupedData.set(period, {
        total: 0,
        available: 0,
        unavailable: 0,
        responseTimes: []
      });
    }
    
    const group = groupedData.get(period)!;
    group.total++;
    
    if (result.isAvailable) {
      group.available++;
      if (result.responseTime !== null && result.responseTime !== undefined) {
        group.responseTimes.push(result.responseTime);
      }
    } else {
      group.unavailable++;
    }
  });
  
  // Convert Map to array and calculate percentages
  return Array.from(groupedData.entries()).map(([period, data]) => {
    const uptimePercentage = data.available / data.total * 100;
    
    // Calculate average response time
    const averageResponseTime = data.responseTimes.length > 0
      ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
      : 0;
    
    return {
      period,
      total: data.total,
      available: data.available,
      unavailable: data.unavailable,
      uptimePercentage,
      averageResponseTime
    };
  }).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get a gradient color based on value
 * @param value The value to get color for (0-100)
 * @param theme Material-UI theme
 * @returns RGB color string
 */
export function getGradientColor(value: number, theme: Theme): string {
  // Success color at 100%, error color at 0%
  const successColor = theme.palette.success.main;
  const warningColor = theme.palette.warning.main;
  const errorColor = theme.palette.error.main;
  
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
  };
  
  let color;
  if (value >= 99) {
    color = successColor;
  } else if (value >= 95) {
    // Gradient between warning and success
    const warningRgb = hexToRgb(warningColor);
    const successRgb = hexToRgb(successColor);
    const ratio = (value - 95) / (99 - 95);
    
    color = `rgb(${Math.round(warningRgb.r + (successRgb.r - warningRgb.r) * ratio)}, ${
      Math.round(warningRgb.g + (successRgb.g - warningRgb.g) * ratio)}, ${
      Math.round(warningRgb.b + (successRgb.b - warningRgb.b) * ratio)})`;
  } else {
    // Gradient between error and warning
    const errorRgb = hexToRgb(errorColor);
    const warningRgb = hexToRgb(warningColor);
    const ratio = Math.max(0, value) / 95;
    
    color = `rgb(${Math.round(errorRgb.r + (warningRgb.r - errorRgb.r) * ratio)}, ${
      Math.round(errorRgb.g + (warningRgb.g - errorRgb.g) * ratio)}, ${
      Math.round(errorRgb.b + (warningRgb.b - errorRgb.b) * ratio)})`;
  }
  
  return color;
}

/**
 * Format date for display based on time range
 * @param date Date to format
 * @param timeRange Selected time range
 * @returns Formatted date string
 */
export function formatDateForTimeRange(date: Date, timeRange: TimeRange): string {
  switch (timeRange) {
    case '1d':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '7d':
      return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    case '30d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case '365d':
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    case 'all':
      return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
    default:
      return date.toLocaleString();
  }
}