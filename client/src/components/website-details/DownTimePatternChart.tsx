// src/components/website-details/DownTimePatternChart.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { MonitoringResult, TimeRange } from "../../types";
import BaseChart from "./BaseChart";
import { useDowntimePatternChartData } from "../../hooks";

interface DowntimePatternChartProps {
  results: MonitoringResult[]; // Already filtered results from parent
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null;
  height?: number;
  title?: string;
}

const DowntimePatternChart: React.FC<DowntimePatternChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null,
  height = 300,
  title = "Downtime Patterns",
}) => {
  // Use our custom hook to prepare chart data and get pattern title
  const { chartData, chartOptions, patternTitle } = useDowntimePatternChartData(
    results,
    timeRange
  );

  return (
    // Use a Box to potentially group the BaseChart and its specific subtitle
    <Box>
      {/* Display the dynamic secondary title (e.g., "By Hour of Day") */}
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
        title={title}
        chartType="bar"
        data={chartData}
        options={chartOptions}
        loading={loading}
        error={error}
        height={height}
      />
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(DowntimePatternChart);