// client/src/components/website-details/ResponseTimeChart.tsx
import React, { useMemo } from "react";
import { useTheme } from "@mui/material";
import { MonitoringResult, TimeRange } from "../../types";
import { formatDateForTimeRange } from "../../utils/charts/common";
import BaseChart from "./BaseChart"; // Import BaseChart
import { ChartOptions, TooltipItem } from "chart.js"; // Import types

// Chart.js registration should be done globally (e.g., in WebsiteDetails.tsx or App.tsx)
// Remove local registration if done globally

interface ResponseTimeChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange;
  loading?: boolean;
  error?: Error | null; // Add error prop
  height?: number;
  title?: string;
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  results,
  timeRange,
  loading = false,
  error = null, // Destructure error
  height = 300,
  title = "Response Time History",
}) => {
  const theme = useTheme();

  // Create sorted results (hook already provides filtered results)
  // Sorting might still be needed depending on filter logic
  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return [];
    // Results from hook are already filtered, just sort
    return [...results].sort(
      (a, b) =>
        new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
    );
  }, [results]); // Only depends on results now

  // Prepare chart data based on sorted results
  const chartData = useMemo(() => {
    if (!sortedResults || sortedResults.length === 0) return null;

    return {
      labels: sortedResults.map((result) =>
        formatDateForTimeRange(new Date(result.checkedAt), timeRange),
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

  // Memoize chart options
  const chartOptions = useMemo((): ChartOptions<"line"> => ({ // Add type annotation
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Response Time (ms)" } },
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
            return sortedResults[index] ? new Date(sortedResults[index].checkedAt).toLocaleString() : "";
          },
          // Add label callback if needed
          label: (context: TooltipItem<"line">) => {
             let label = context.dataset.label || '';
             if (label) {
                 label += ': ';
             }
             if (context.parsed.y !== null) {
                 label += `${context.parsed.y} ms`;
             }
             return label;
          }
        },
      },
    },
  }), [sortedResults]); // Options depend on sortedResults for tooltip

  // Render using BaseChart
  return (
    <BaseChart
      title={title}
      chartType="line"
      data={chartData}
      options={chartOptions}
      loading={loading}
      error={error} // Pass error down
      height={height}
    />
  );
};

export default React.memo(ResponseTimeChart);