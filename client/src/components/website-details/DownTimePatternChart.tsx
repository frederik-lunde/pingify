// src/components/website-details/DowntimePatternChart.tsx
import React, { useMemo } from "react";
import { Paper, Typography, Box, useTheme, Skeleton } from "@mui/material";
import { Bar } from "react-chartjs-2";
import { MonitoringResult } from "../../types";
import {
  prepareDowntimeByHourData,
  getDowntimeByHourOptions,
  prepareDowntimeByWeekdayData,
  getDowntimeByWeekdayOptions,
} from "../../utils/charts/downTimeChart";
import { TimeRange } from "./TimeRangeSelector";

// Import required chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface DowntimePatternChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange;
  loading?: boolean;
  height?: number;
  title?: string;
}

const DowntimePatternChart: React.FC<DowntimePatternChartProps> = ({
  results,
  timeRange,
  loading = false,
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
      case "all":
        return "month"; // For year/all, show monthly patterns (though month implementation would need to be added)
      default:
        return "hour";
    }
  }, [timeRange]);

  // Get appropriate title based on pattern type
  const patternTitle = useMemo(() => {
    switch (patternType) {
      case "hour":
        return "By Hour of Day";
      case "weekday":
        return "By Day of Week";
      case "month":
        return "By Month of Year";
      default:
        return "Distribution";
    }
  }, [patternType]);

  // Memoize chart data and options for better performance
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;

    switch (patternType) {
      case "hour":
        return prepareDowntimeByHourData(results, timeRange, theme);
      case "weekday":
        return prepareDowntimeByWeekdayData(results, timeRange, theme);
      case "month":
        // For now, fall back to weekday data for month pattern
        // This would be replaced with actual month-based data in a real implementation
        return prepareDowntimeByWeekdayData(results, timeRange, theme);
      default:
        return prepareDowntimeByHourData(results, timeRange, theme);
    }
  }, [results, timeRange, theme, patternType]);

  const chartOptions = useMemo(() => {
    switch (patternType) {
      case "hour":
        return getDowntimeByHourOptions();
      case "weekday":
      case "month":
        return getDowntimeByWeekdayOptions();
      default:
        return getDowntimeByHourOptions();
    }
  }, [patternType]);

  // Show loading state
  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ height }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            animation="wave"
          />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">{title}</Typography>
        <Typography variant="subtitle2" color="textSecondary">
          {patternTitle}
        </Typography>
      </Box>

      <Box sx={{ height }}>
        {results && results.length > 0 && chartData ? (
          <Bar data={chartData} options={chartOptions} />
        ) : (
          <Box
            display="flex"
            height="100%"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="body1" color="textSecondary">
              No data available for chart
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(DowntimePatternChart);
