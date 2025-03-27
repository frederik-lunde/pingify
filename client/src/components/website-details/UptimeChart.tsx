// client/src/components/website-details/UptimeChart.tsx
import React, { useMemo } from "react";
import { useTheme } from "@mui/material";
import { MonitoringResult, TimeRange } from "../../types";
import {
  prepareUptimeStatusData,
  getUptimeStatusOptions,
} from "../../utils/charts/uptimeChart";
import BaseChart from "./BaseChart";
import { ChartOptions } from "chart.js"; // Import types

interface UptimeChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null; // Add error prop
  height?: number;
  title?: string;
}

const UptimeChart: React.FC<UptimeChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null, // Destructure error
  height = 300,
  title = "Uptime Status",
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    // prepareUptimeStatusData expects unfiltered results if it does filtering internally,
    // or filtered results if it doesn't. The hook now provides filtered results.
    // Ensure prepareUptimeStatusData handles this correctly or adjust the hook/utility.
    // Assuming prepareUptimeStatusData now works with the already filtered `results`.
    if (!results || results.length === 0) return null;
    return prepareUptimeStatusData(results, timeRange, theme);
  }, [results, timeRange, theme]); // Depends on filtered results

  const chartOptions = useMemo(
    (): ChartOptions<"bar"> => getUptimeStatusOptions(),
    [],
  );

  return (
    <BaseChart
      title={title}
      chartType="bar"
      data={chartData}
      options={chartOptions}
      loading={loading}
      error={error} // Pass error
      height={height}
    />
  );
};

export default React.memo(UptimeChart);
