// client/src/components/website-details/ResponseTimeChart.tsx
import React from "react";
import { MonitoringResult, TimeRange } from "../../types";
import BaseChart from "./BaseChart"; // Import BaseChart
import { useResponseTimeChartData } from "../../hooks";

interface ResponseTimeChartProps {
  results: MonitoringResult[]; // Already filtered results from parent
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null;
  height?: number;
  title?: string;
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null,
  height = 300,
  title = "Response Time History",
}) => {
  // Use our custom hook to prepare chart data - much cleaner!
  const { chartData, chartOptions } = useResponseTimeChartData(results, timeRange);

  // Render using BaseChart
  return (
    <BaseChart
      title={title}
      chartType="line"
      data={chartData}
      options={chartOptions}
      loading={loading}
      error={error}
      height={height}
    />
  );
};

export default React.memo(ResponseTimeChart);