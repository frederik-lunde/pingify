// src/components/website-details/UptimeChart.tsx
import React, { useMemo } from "react";
import { Paper, Typography, Box, useTheme, Skeleton } from "@mui/material";
import { Bar } from "react-chartjs-2";
import { MonitoringResult } from "../../types";
import {
  prepareUptimeStatusData,
  getUptimeStatusOptions,
} from "../../utils/charts/uptimeChart";
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

interface UptimeChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange;
  loading?: boolean;
  height?: number;
  title?: string;
}

const UptimeChart: React.FC<UptimeChartProps> = ({
  results,
  timeRange,
  loading = false,
  height = 300,
  title = "Uptime Status",
}) => {
  const theme = useTheme();

  // Memoize chart data and options for better performance
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;
    return prepareUptimeStatusData(results, timeRange, theme);
  }, [results, timeRange, theme]);

  const chartOptions = useMemo(() => getUptimeStatusOptions(), []);

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
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
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
export default React.memo(UptimeChart);
