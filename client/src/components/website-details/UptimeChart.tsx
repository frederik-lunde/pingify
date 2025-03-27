// client/src/components/website-details/UptimeChart.tsx
import React from "react";
import { MonitoringResult, TimeRange } from "../../types";
import BaseChart from "./BaseChart";
import { useUptimeChartData } from "../../hooks";

interface UptimeChartProps {
  results: MonitoringResult[]; // Already filtered results from parent
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null;
  height?: number;
  title?: string;
}

const UptimeChart: React.FC<UptimeChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null,
  height = 300,
  title = "Uptime Status",
}) => {
  // Use our custom hook to prepare chart data
  const { chartData, chartOptions } = useUptimeChartData(results, timeRange);

  return (
    <BaseChart
      title={title}
      chartType="bar"
      data={chartData}
      options={chartOptions}
      loading={loading}
      error={error}
      height={height}
    />
  );
};

export default React.memo(UptimeChart);