// src/components/website-details/DownTimePatternChart.tsx
import React, { useMemo } from "react";
import { useTheme, Box, Typography } from "@mui/material"; // Keep Box/Typography for subtitle
import { MonitoringResult, TimeRange } from "../../types"; // Import from types.ts
import {
  prepareDowntimeByHourData,
  getDowntimeByHourOptions,
  prepareDowntimeByWeekdayData,
  getDowntimeByWeekdayOptions,
  // Add imports for month/other patterns if implemented later
  // prepareDowntimeByMonthData,
  // getDowntimeByMonthOptions,
} from "../../utils/charts/downTimeChart"; // Ensure correct path
import BaseChart from "./BaseChart"; // Import the base component
import { ChartOptions } from "chart.js"; // Import ChartOptions type

// Chart.js registration should be done globally (e.g., in WebsiteDetails.tsx or App.tsx)
// Remove any local ChartJS.register calls if they existed

interface DowntimePatternChartProps {
  results: MonitoringResult[]; // Expects already filtered results from the hook
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null; // Add error prop for BaseChart
  height?: number;
  title?: string;
}

const DowntimePatternChart: React.FC<DowntimePatternChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null, // Destructure error prop
  height = 300,
  title = "Downtime Patterns",
}) => {
  const theme = useTheme();

  // Determine the appropriate pattern type based on timeRange
  const patternType = useMemo(() => {
    switch (timeRange) {
      case "1d":
        return "hour"; // For 1 day, show hourly breakdown
      case "7d":
      case "30d":
        return "weekday"; // For week/month, show day of week patterns
      case "365d":
        // case "all": // Decide if 'all' should show month or weekday
        return "weekday"; // Or potentially "month" if implemented
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
      // case "month": return "By Month of Year"; // Add when implemented
      default:
        return "Distribution";
    }
  }, [patternType]);

  // Memoize chart data preparation
  const chartData = useMemo(() => {
    // Results are pre-filtered by the hook based on timeRange.
    // The prepare functions might still filter internally based on timeRange,
    // which is slightly redundant but acceptable for now.
    // Ideally, the prepare functions would only aggregate the provided results.
    if (!results || results.length === 0) return null;

    try {
      switch (patternType) {
        case "hour":
          return prepareDowntimeByHourData(results, timeRange, theme);
        case "weekday":
          return prepareDowntimeByWeekdayData(results, timeRange, theme);
        // case "month": // Add when month data preparation is implemented
        //   return prepareDowntimeByMonthData(results, timeRange, theme);
        default:
          // Fallback gracefully, maybe return null or default to hour
          console.warn(
            `Unsupported patternType '${patternType}' in DowntimePatternChart. Falling back to hour.`,
          );
          return prepareDowntimeByHourData(results, timeRange, theme);
      }
    } catch (prepError) {
      console.error("Error preparing downtime chart data:", prepError);
      // You could potentially pass this specific error down to BaseChart
      return null; // Return null to show empty/error state in BaseChart
    }
  }, [results, timeRange, theme, patternType]); // Dependencies include patternType now

  // Memoize chart options selection
  const chartOptions = useMemo((): ChartOptions<"bar"> => {
    // Explicit type
    try {
      switch (patternType) {
        case "hour":
          return getDowntimeByHourOptions();
        case "weekday":
          return getDowntimeByWeekdayOptions();
        // case "month": // Add when month options are implemented
        //   return getDowntimeByMonthOptions();
        default:
          // Fallback gracefully
          return getDowntimeByHourOptions();
      }
    } catch (optionsError) {
      console.error("Error getting downtime chart options:", optionsError);
      return {}; // Return empty options or default
    }
  }, [patternType]); // Options depend only on patternType

  return (
    // Use a Box to potentially group the BaseChart and its specific subtitle
    <Box>
      {/* Display the dynamic secondary title (e.g., "By Hour of Day") */}
      {/* Position it relative to the BaseChart */}
      <Typography
        variant="subtitle2"
        color="textSecondary"
        align="right"
        // Adjust styling for positioning above the chart area within the Paper
        sx={{ mb: -2.5, mr: 3, position: "relative", zIndex: 1 }}
      >
        {patternTitle}
      </Typography>

      {/* Use the BaseChart component for rendering */}
      <BaseChart
        title={title} // Main title (e.g., "Downtime Patterns")
        chartType="bar"
        data={chartData} // Pass prepared data
        options={chartOptions} // Pass selected options
        loading={loading} // Pass loading state
        error={error} // Pass error state
        height={height} // Pass height
        // Optionally customize empty message
        // emptyMessage="No downtime patterns found for this period."
      />
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(DowntimePatternChart);
