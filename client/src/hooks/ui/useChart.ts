// src/hooks/ui/useChartHooks.ts
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
// Use TimeframeKey from types, MonitoringResult for data
import { MonitoringResult, TimeframeKey } from '../../types';
import { ChartOptions, TooltipItem } from 'chart.js'; // Chart.js types
// Import updated utility functions that still exist
import {
  filterResultsByTimeRange, // Filters based on timeframe key
  formatDateForTimeRange, // Formats labels based on timeframe key
  sortResultsByTime, // Utility to sort results if needed
} from '../../utils/charts/common'; // Adjust path if needed
// Removed imports for uptimeChart and downTimeChart utilities

/**
 * Manages the selected time range state, ensuring it's valid for the current context (e.g., tab).
 * @param initialRange The initial TimeframeKey to use.
 * @param availableRanges An array of TimeframeKey values allowed in the current context.
 * @returns An object containing the current timeRange state, a function to set it, and the list of available ranges.
 */
export function useTimeRangeSelection(initialRange: TimeframeKey, availableRanges: TimeframeKey[]) {
  const [timeRange, setTimeRangeState] = useState<TimeframeKey>(initialRange);

  // Effect to reset timeRange if the current selection becomes invalid due to context change
  useEffect(() => {
    // If the current timeRange is not in the list of allowed ranges, reset to the first available one.
    if (!availableRanges.includes(timeRange)) {
      setTimeRangeState(availableRanges[0] || 'day'); // Default to 'day' if availableRanges is empty
    }
  }, [availableRanges, timeRange]); // Rerun when available ranges or the current range changes

  // Stable callback function to update the time range state.
  const setTimeRange = useCallback((newRange: TimeframeKey) => {
    setTimeRangeState(newRange);
  }, []); // No dependencies needed as setTimeRangeState is stable

  return {
    timeRange,        // The current selected TimeframeKey
    setTimeRange,     // Function to update the timeRange
    availableRanges,  // The list of allowed TimeframeKeys
  };
}

/**
 * Prepares data and options specifically for the response time line chart.
 * @param results Array of MonitoringResult data points, potentially pre-filtered.
 * @param timeRange The currently selected TimeframeKey, used for formatting labels.
 * @returns An object containing `chartData` and `chartOptions` for Chart.js.
 */
export function useResponseTimeChartData(results: MonitoringResult[], timeRange: TimeframeKey) {
  const theme = useTheme();

  // Memoize the processing of results to filter and sort them for the chart.
  const processedResults = useMemo(() => {
    if (!results || results.length === 0) return [];
    // 1. Filter for results that are 'available' and have a valid 'responseTime'.
    // 2. Sort these results chronologically (oldest first) for the line chart.
    return results
        .filter(r => r.isAvailable && r.responseTime != null)
        .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
  }, [results]); // Recalculate only when the input results array changes

  // Memoize the creation of the Chart.js data structure.
  const chartData = useMemo(() => {
    // If no processed results, return null to indicate no chart should be rendered.
    if (!processedResults || processedResults.length === 0) return null;

    return {
      // Generate labels using the updated formatDateForTimeRange utility.
      labels: processedResults.map((result) =>
        formatDateForTimeRange(new Date(result.checkedAt), timeRange)
      ),
      datasets: [
        {
          label: "Response Time (ms)", // Label for tooltips and potential legend
          // Map response times to the data array.
          data: processedResults.map((result) => result.responseTime),
          borderColor: theme.palette.primary.main, // Line color from theme
          backgroundColor: theme.palette.primary.light + '33', // Area fill color with transparency
          fill: true, // Fill area under the line
          tension: 0.2, // Slightly smooth the line
          pointRadius: 1.5, // Size of points on the line
          pointHoverRadius: 4, // Size of points on hover
          borderWidth: 1.5, // Thickness of the line
        },
      ],
    };
    // Recalculate if processed results, timeframe (for labels), or theme changes.
  }, [processedResults, timeRange, theme]);

  // Memoize the creation of the Chart.js options structure.
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({ // Explicit type
    responsive: true, // Chart should resize with container
    maintainAspectRatio: false, // Don't maintain aspect ratio, fill container height/width
    scales: {
      y: { // Y-axis configuration (Response Time)
        beginAtZero: true, // Start axis at 0
        title: { display: true, text: "Response Time (ms)", align: 'end', font: { size: 10 } }, // Axis title
         ticks: { font: { size: 10 } }, // Smaller ticks font size
         grid: { drawTicks: false } // Hide grid tick lines
      },
      x: { // X-axis configuration (Time)
        title: { display: false }, // Hide title (labels imply time)
        ticks: {
            maxRotation: 0, // Keep labels horizontal
            minRotation: 0,
            autoSkip: true, // Automatically skip labels to prevent overlap
            maxTicksLimit: 10, // Limit the max number of visible ticks
            font: { size: 10 }
        },
        grid: { display: false } // Hide vertical grid lines
      },
    },
    plugins: {
      legend: { display: false }, // Hide the dataset legend
      tooltip: { // Tooltip configuration on hover
        mode: 'index', // Show tooltip for all datasets at the hovered index
        intersect: false, // Tooltip appears even if not directly hovering over a point
        callbacks: { // Custom tooltip content
          title: (tooltipItems: TooltipItem<"line">[]) => {
            // Display full date/time in tooltip title
            const index = tooltipItems[0]?.dataIndex;
            return (index !== undefined && processedResults[index])
              ? new Date(processedResults[index].checkedAt).toLocaleString()
              : "";
          },
          label: (context: TooltipItem<"line">) => {
            // Display "Label: Value ms" in tooltip body
            let label = context.dataset.label || "";
            if (label) label += ": ";
            if (context.parsed.y !== null) label += `${context.parsed.y} ms`;
            return label;
          },
        },
      },
    },
    interaction: { // Interaction settings
        mode: 'index',
        intersect: false,
    },
    elements: { // Styling for chart elements
        point: { radius: 1.5, hoverRadius: 4 }, // Default point sizes
        line: { tension: 0.2, borderWidth: 1.5 } // Default line style
    }
    // Recalculate options if processed results change (needed for tooltip title callback).
  }), [processedResults]);

  return { chartData, chartOptions };
}

/**
 * Applies client-side filtering based on a timeframe.
 * Note: This might be redundant if the API endpoint already filters by timeframe.
 * @param allResults The complete array of MonitoringResult data points.
 * @param timeRange The TimeframeKey to filter by.
 * @returns A new array containing only the results within the specified timeframe.
 */
export function useFilteredResults(allResults: MonitoringResult[], timeRange: TimeframeKey) {
  return useMemo(() => {
    if (!allResults || allResults.length === 0) return [];
    // Use the updated utility function from common.ts
    return filterResultsByTimeRange(allResults, timeRange);
  }, [allResults, timeRange]); // Recalculate if results or timeframe change
}

/**
 * Prepares data and options specifically for the small line chart used in WebsiteCard.
 * @param results Array of recent MonitoringResult data points for the specific website.
 * @param limit Maximum number of data points to display on the chart.
 * @returns An object containing `chartData` and `chartOptions` for Chart.js.
 */
export function useCardChartData(results: MonitoringResult[], limit: number = 10) {
  const theme = useTheme();

  // Memoize the preparation of chart data.
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;

    // 1. Sort the incoming results (assumed recent) newest first.
    // 2. Take the latest 'limit' results.
    // 3. Reverse the order so the oldest of the 'limit' is first for the chart line.
    const limitedSortedResults = [...results]
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
        .slice(0, limit)
        .reverse();

    // 4. Filter these limited results to include only available checks with response times.
    const responseData = limitedSortedResults.filter(r => r.isAvailable && r.responseTime != null);

    // If no valid response data points remain after filtering, return null.
    if (responseData.length === 0) return null;

    return {
      // Labels aren't displayed, but might be useful for tooltips if enabled.
      labels: responseData.map((r) =>
        // Use the updated utility for formatting
        formatDateForTimeRange(new Date(r.checkedAt), 'hour') // Example: Use 'hour' format
      ),
      datasets: [
        {
          label: "Response Time", // Tooltip label
          // Map the response times.
          data: responseData.map((r) => r.responseTime),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.main + "1A", // Lighter fill, less alpha
          fill: true,
          tension: 0.4, // Smoother curve for visual appeal in small chart
          pointRadius: 0, // Hide points
          pointHoverRadius: 0, // Hide points on hover
          borderWidth: 1.5, // Keep line relatively thin
        },
      ],
    };
    // Recalculate if results, limit, or theme changes.
  }, [results, limit, theme]);

  // Memoize the chart options, optimized for a small card display.
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({ // Explicit type
    responsive: true,
    maintainAspectRatio: false, // Crucial for fitting into card space
    plugins: {
      legend: { display: false }, // No legend needed
      tooltip: { enabled: false }, // Disable tooltips for card charts by default
    },
    scales: { // Hide both axes completely
      x: { display: false },
      y: { display: false },
    },
    layout: { padding: 0 }, // Remove chart padding
    elements: { // Style line elements
        line: { borderCapStyle: 'round', borderJoinStyle: 'round' }
    },
    animation: false, // Disable animation for performance in multiple cards
  }), []); // Options are static now (tooltip disabled)

  return { chartData, chartOptions };
}