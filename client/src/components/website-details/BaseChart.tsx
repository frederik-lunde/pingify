// client/src/components/website-details/BaseChart.tsx
import React from "react";
import {
  Paper,
  Typography,
  Box,
  Skeleton,
  Alert,
  AlertTitle,
} from "@mui/material";
import { Line, Bar } from "react-chartjs-2";
import { ChartData, ChartOptions } from "chart.js";


type ChartType = "line" | "bar";

interface BaseChartProps {
  title: string;
  chartType: ChartType;
  data: ChartData<ChartType> | null;
  options: ChartOptions<ChartType>;
  loading?: boolean;
  error?: Error | null;
  height?: number;
  emptyMessage?: string;
}

const BaseChart: React.FC<BaseChartProps> = ({
  title,
  chartType,
  data,
  options,
  loading = false,
  error = null,
  height = 300,
  emptyMessage = "No data available for chart",
}) => {
  const ChartComponent = chartType === "line" ? Line : Bar;

  const renderContent = () => {
    // 1. Loading State
    if (loading) {
      return (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
        />
      );
    }

    // 2. Error State
    if (error) {
      return (
        <Box
          display="flex"
          height="100%"
          alignItems="center"
          justifyContent="center"
          sx={{ p: 2 }}
        >
          <Alert severity="error" sx={{ width: "100%" }}>
            <AlertTitle>Error Loading Chart</AlertTitle>
            {error.message || "An unexpected error occurred."}
          </Alert>
        </Box>
      );
    }

    // 3. Empty State (or data seems invalid)
    if (!data || !data.labels || data.labels.length === 0 || !data.datasets || data.datasets.length === 0 || data.datasets.every(ds => ds.data.length === 0)) {
      return (
        <Box
          display="flex"
          height="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="body1" color="textSecondary">
            {emptyMessage}
          </Typography>
        </Box>
      );
    }

    // 4. Render Chart
    return <ChartComponent data={data as any} options={options as any} />; // Cast needed due to Chart.js typing quirks
  };

  return (
    <Paper sx={{ p: 3, mb: 3, overflow: 'hidden' }}> {/* Added overflow hidden */}
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ height, position: 'relative' }}> {/* Ensure relative positioning for chart */}
        {renderContent()}
      </Box>
    </Paper>
  );
};

export default React.memo(BaseChart); // Memoize for performance