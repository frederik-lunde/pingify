import { MonitoringResult } from "../types";
import { ChartOptions, ChartData } from "chart.js";
import { Theme } from "@mui/material";

/**
 * Sorts and formats monitoring results data for consistent chart usage
 * @param monitoringResults Raw monitoring results
 * @param limit Maximum number of data points to include
 * @returns Sorted array of monitoring results (oldest first)
 */
export const prepareTimeSeriesData = (
  monitoringResults: MonitoringResult[],
  limit: number = 20,
): MonitoringResult[] => {
  if (!monitoringResults || monitoringResults.length === 0) return [];

  // Sort by timestamp (oldest first)
  return [...monitoringResults]
    .sort(
      (a, b) =>
        new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
    )
    .slice(-limit); // Take only the most recent N results
};

/**
 * Prepares chart data for the detailed view (ResponseTimeChart)
 * @param monitoringResults Monitoring results array
 * @param theme MUI theme for colors
 * @param limit Maximum number of data points
 * @returns Chart.js data object
 */
export const prepareDetailedChartData = (
  monitoringResults: MonitoringResult[],
  theme: Theme,
  limit: number = 20,
): ChartData<"line"> => {
  const chartData = prepareTimeSeriesData(monitoringResults, limit);

  return {
    labels: chartData.map((r) => new Date(r.checkedAt).toLocaleTimeString()),
    datasets: [
      {
        label: "Response Time (ms)",
        data: chartData.map((r) => r.responseTime || 0),
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.light,
        fill: false,
        tension: 0.1,
      },
    ],
  };
};

/**
 * Prepares chart data for the compact card view (WebsiteCard)
 * @param monitoringResults Monitoring results array
 * @param theme MUI theme for colors
 * @param limit Maximum number of data points
 * @returns Chart.js data object
 */
export const prepareCardChartData = (
  monitoringResults: MonitoringResult[],
  theme: Theme,
  limit: number = 10,
): ChartData<"line"> => {
  const chartData = prepareTimeSeriesData(monitoringResults, limit);

  return {
    labels: chartData.map((r) =>
      new Date(r.checkedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ),
    datasets: [
      {
        data: chartData.map((r) => r.responseTime || 0),
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.main + "33", // Add transparency
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      },
    ],
  };
};

/**
 * Gets chart options for the detailed view (ResponseTimeChart)
 * @returns Chart.js options
 */
export const getDetailedChartOptions = (): ChartOptions<"line"> => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Response Time (ms)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Time",
        },
        ticks: {
          maxRotation: 30,
          minRotation: 30,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: "Response Time History",
      },
    },
  };
};

/**
 * Gets chart options for the compact card view (WebsiteCard)
 * @returns Chart.js options
 */
export const getCardChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, // Hide legend
    },
    tooltip: {
      enabled: true,
      mode: "index" as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      display: true, // Show x-axis title
      title: {
        display: true,
        text: "Response time: 10 Checks", // X-axis label
      },
      ticks: {
        display: false, // Hide x-axis values
      },
      grid: {
        display: false, // Remove x-axis grid lines
      },
    },
    y: {
      display: false, // Show y-axis title
      title: {
        display: true,
        text: "Response Time (ms)", // Y-axis label
      },
      ticks: {
        display: false, // Hide y-axis values
      },
      grid: {
        display: false, // Remove y-axis grid lines
      },
    },
  },
});
