// src/hooks/ui/useChartHooks.ts
import { useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material';
import { MonitoringResult, TimeRange } from '../../types';
import { ChartOptions, TooltipItem } from 'chart.js';
import {
  filterResultsByTimeRange,
  formatDateForTimeRange
} from '../../utils/charts/common';
import { 
  prepareUptimeStatusData, 
  getUptimeStatusOptions 
} from '../../utils/charts/uptimeChart';
import {
  prepareDowntimeByHourData,
  getDowntimeByHourOptions,
  prepareDowntimeByWeekdayData,
  getDowntimeByWeekdayOptions
} from '../../utils/charts/downTimeChart';

/**
 * Custom hook for time range management across tabs
 * @param initialRange Initial time range
 * @param activeTab Current active tab index
 * @returns Object containing time range state and management
 */
export function useTimeRangeSelection(initialRange: TimeRange, activeTab: number) {
  const [timeRange, setTimeRangeState] = useState<TimeRange>(initialRange);
  
  // Get available time ranges based on the active tab
  const availableRanges = useMemo(() => {
    switch (activeTab) {
      case 0: // Response Time
      case 1: // Uptime Status
      case 3: // Recent Checks
        return ["1d", "7d", "30d", "365d", "all"] as TimeRange[];
      case 2: // Downtime Patterns
        return ["1d", "7d", "30d", "365d"] as TimeRange[]; // 'all' might be too much for patterns
      default:
        return ["1d", "7d", "30d", "365d", "all"] as TimeRange[];
    }
  }, [activeTab]);
  
  // Ensure selected range is valid for current tab
  useEffect(() => {
    if (!availableRanges.includes(timeRange)) {
      setTimeRangeState(availableRanges[0]);
    }
  }, [availableRanges, timeRange]);
  
  // Wrapper function to match the expected onChange signature
  const setTimeRange = useCallback((newRange: TimeRange) => {
    setTimeRangeState(newRange);
  }, []);
  
  return { 
    timeRange, 
    setTimeRange, 
    availableRanges 
  };
}

/**
 * Custom hook for preparing response time chart data
 * @param results Filtered monitoring results
 * @param timeRange Current time range
 * @returns Object with chart data and options
 */
export function useResponseTimeChartData(results: MonitoringResult[], timeRange: TimeRange) {
  const theme = useTheme();
  
  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return [];
    
    // Results should already be filtered by time range
    return [...results].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );
  }, [results]);
  
  const chartData = useMemo(() => {
    if (!sortedResults || sortedResults.length === 0) return null;

    return {
      labels: sortedResults.map((result) =>
        formatDateForTimeRange(new Date(result.checkedAt), timeRange)
      ),
      datasets: [
        {
          label: "Response Time (ms)",
          data: sortedResults.map((result) => result.responseTime || 0),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.main + "20",
          fill: true,
          tension: 0.1,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    };
  }, [sortedResults, timeRange, theme]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Response Time (ms)" },
      },
      x: {
        title: { display: true, text: "Time" },
        ticks: { maxRotation: 30, minRotation: 30 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (tooltipItems: TooltipItem<"line">[]) => {
            const index = tooltipItems[0].dataIndex;
            return sortedResults[index]
              ? new Date(sortedResults[index].checkedAt).toLocaleString()
              : "";
          },
          label: (context: TooltipItem<"line">) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y} ms`;
            }
            return label;
          },
        },
      },
    },
  }), [sortedResults]);

  return { chartData, chartOptions };
}

/**
 * Custom hook for preparing uptime chart data
 * @param results Filtered monitoring results
 * @param timeRange Current time range
 * @returns Object with chart data and options
 */
export function useUptimeChartData(results: MonitoringResult[], timeRange: TimeRange) {
  const theme = useTheme();
  
  const chartData = useMemo(() => {
    // Results should already be filtered
    if (!results || results.length === 0) return null;
    return prepareUptimeStatusData(results, timeRange, theme);
  }, [results, timeRange, theme]);

  const chartOptions = useMemo(() => getUptimeStatusOptions(), []);

  return { chartData, chartOptions };
}

/**
 * Custom hook for preparing downtime pattern chart data
 * @param results Filtered monitoring results
 * @param timeRange Current time range
 * @returns Object with chart data and options
 */
export function useDowntimePatternChartData(results: MonitoringResult[], timeRange: TimeRange) {
  const theme = useTheme();
  
  // Determine the appropriate pattern type based on timeRange
  const patternType = useMemo(() => {
    switch (timeRange) {
      case "1d":
        return "hour"; // For 1 day, show hourly breakdown
      case "7d":
      case "30d":
      case "365d":
        return "weekday"; // For week/month/year, show day of week patterns
      default:
        return "hour"; // Fallback
    }
  }, [timeRange]);

  // Get appropriate secondary title based on pattern type
  const patternTitle = useMemo(() => {
    switch (patternType) {
      case "hour":
        return "By Hour of Day";
      case "weekday":
        return "By Day of Week";
      default:
        return "Distribution";
    }
  }, [patternType]);

  // Memoize chart data preparation
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;

    try {
      switch (patternType) {
        case "hour":
          return prepareDowntimeByHourData(results, timeRange, theme);
        case "weekday":
          return prepareDowntimeByWeekdayData(results, timeRange, theme);
        default:
          return prepareDowntimeByHourData(results, timeRange, theme);
      }
    } catch (prepError) {
      console.error("Error preparing downtime chart data:", prepError);
      return null;
    }
  }, [results, timeRange, theme, patternType]);

  // Memoize chart options selection
  const chartOptions = useMemo((): ChartOptions<"bar"> => {
    try {
      switch (patternType) {
        case "hour":
          return getDowntimeByHourOptions();
        case "weekday":
          return getDowntimeByWeekdayOptions();
        default:
          return getDowntimeByHourOptions();
      }
    } catch (optionsError) {
      console.error("Error getting downtime chart options:", optionsError);
      return {};
    }
  }, [patternType]);

  return { chartData, chartOptions, patternTitle };
}

/**
 * Hook for applying filtering to results based on time range
 * @param allResults All available monitoring results
 * @param timeRange Current time range selection
 * @returns Filtered results for the selected time range
 */
export function useFilteredResults(allResults: MonitoringResult[], timeRange: TimeRange) {
  return useMemo(() => {
    if (!allResults || allResults.length === 0) return [];
    return filterResultsByTimeRange(allResults, timeRange);
  }, [allResults, timeRange]);
}

// Import at the top
import { useState, useEffect } from 'react';