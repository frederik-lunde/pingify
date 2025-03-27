// src/utils/charts/downtimeCharts.ts
import { Theme } from "@mui/material";
import { ChartData, ChartOptions } from "chart.js";
import { MonitoringResult } from "../../types";
import { TimeRange } from "../../components/website-details/TimeRangeSelector";
import { filterResultsByTimeRange } from "./common";

/**
 * Prepares data for the downtime by hour of day chart
 * @param results Monitoring results
 * @param timeRange Selected time range for filtering results
 * @param theme Material-UI theme
 * @returns Chart.js data object
 */
export function prepareDowntimeByHourData(
  results: MonitoringResult[],
  timeRange: TimeRange,
  theme: Theme,
): ChartData<"bar"> {
  // Initialize arrays for each hour of the day (0-23)
  const totalChecksByHour = Array(24).fill(0);
  const downtimeByHour = Array(24).fill(0);

  // Filter results by time range
  const filteredResults = filterResultsByTimeRange(results, timeRange);

  if (!filteredResults.length) {
    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: "Downtime Frequency",
          data: Array(24).fill(0),
          backgroundColor: theme.palette.primary.main,
          borderColor: theme.palette.primary.dark,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }

  // Process each result
  filteredResults.forEach((result) => {
    const date = new Date(result.checkedAt);
    const hour = date.getHours();

    totalChecksByHour[hour]++;

    if (!result.isAvailable) {
      downtimeByHour[hour]++;
    }
  });

  // Calculate percentage of downtime for each hour
  const downtimePercentageByHour = totalChecksByHour.map((total, index) =>
    total > 0 ? (downtimeByHour[index] / total) * 100 : 0,
  );

  // Create gradient colors based on downtime percentage
  const colors = downtimePercentageByHour.map((percentage) => {
    const alpha = Math.max(0.2, Math.min(0.8, percentage / 100));
    return (
      theme.palette.error.main +
      Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    );
  });

  // Create labels for each hour
  const labels = Array.from(
    { length: 24 },
    (_, i) => `${i.toString().padStart(2, "0")}:00`,
  );

  return {
    labels,
    datasets: [
      {
        label: "Downtime Frequency (%)",
        data: downtimePercentageByHour,
        backgroundColor: colors,
        borderColor: theme.palette.error.dark,
        borderWidth: 1,
        borderRadius: 4,
        // Store raw data for tooltips with type assertion
        rawData: {
          totalChecks: totalChecksByHour,
          downtimeCount: downtimeByHour,
        },
      } as any,
    ],
  };
}

/**
 * Gets chart options for the downtime by hour chart
 * @returns Chart.js options
 */
export function getDowntimeByHourOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Downtime %",
        },
        ticks: {
          callback: function (value) {
            return value + "%";
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Hour of Day (24h)",
        },
        grid: {
          offset: false,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const dataset = context.dataset;
            const index = context.dataIndex;
            const value = dataset.data[index] as number;
            return `Downtime: ${value.toFixed(2)}%`;
          },
          afterLabel: function (context) {
            const dataset = context.dataset as any;
            const rawData = dataset.rawData;
            const index = context.dataIndex;

            if (rawData) {
              return [
                `Total checks: ${rawData.totalChecks[index]}`,
                `Downtime incidents: ${rawData.downtimeCount[index]}`,
              ];
            }
            return [];
          },
        },
      },
      legend: {
        display: false,
      },
    },
  };
}

/**
 * Prepares data for the downtime by day of week chart
 * @param results Monitoring results
 * @param timeRange Selected time range for filtering results
 * @param theme Material-UI theme
 * @returns Chart.js data object
 */
export function prepareDowntimeByWeekdayData(
  results: MonitoringResult[],
  timeRange: TimeRange,
  theme: Theme,
): ChartData<"bar"> {
  // Initialize arrays for each day of the week (0-6, Sunday-Saturday)
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const totalChecksByDay = Array(7).fill(0);
  const downtimeByDay = Array(7).fill(0);

  // Filter results by time range
  const filteredResults = filterResultsByTimeRange(results, timeRange);

  if (!filteredResults.length) {
    return {
      labels: days,
      datasets: [
        {
          label: "Downtime Frequency",
          data: Array(7).fill(0),
          backgroundColor: theme.palette.primary.main,
          borderColor: theme.palette.primary.dark,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }

  // Process each result
  filteredResults.forEach((result) => {
    const date = new Date(result.checkedAt);
    const day = date.getDay(); // 0-6

    totalChecksByDay[day]++;

    if (!result.isAvailable) {
      downtimeByDay[day]++;
    }
  });

  // Calculate percentage of downtime for each day
  const downtimePercentageByDay = totalChecksByDay.map((total, index) =>
    total > 0 ? (downtimeByDay[index] / total) * 100 : 0,
  );

  // Create gradient colors based on downtime percentage
  const colors = downtimePercentageByDay.map((percentage) => {
    const alpha = Math.max(0.2, Math.min(0.8, percentage / 100));
    return (
      theme.palette.error.main +
      Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    );
  });

  return {
    labels: days,
    datasets: [
      {
        label: "Downtime Frequency (%)",
        data: downtimePercentageByDay,
        backgroundColor: colors,
        borderColor: theme.palette.error.dark,
        borderWidth: 1,
        borderRadius: 4,
        // Store raw data for tooltips with type assertion
        rawData: {
          totalChecks: totalChecksByDay,
          downtimeCount: downtimeByDay,
        },
      } as any,
    ],
  };
}

/**
 * Gets chart options for the downtime by weekday chart
 * @returns Chart.js options
 */
export function getDowntimeByWeekdayOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Downtime %",
        },
        ticks: {
          callback: function (value) {
            return value + "%";
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Day of Week",
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const dataset = context.dataset;
            const index = context.dataIndex;
            const value = dataset.data[index] as number;
            return `Downtime: ${value.toFixed(2)}%`;
          },
          afterLabel: function (context) {
            const dataset = context.dataset as any;
            const rawData = dataset.rawData;
            const index = context.dataIndex;

            if (rawData) {
              return [
                `Total checks: ${rawData.totalChecks[index]}`,
                `Downtime incidents: ${rawData.downtimeCount[index]}`,
              ];
            }
            return [];
          },
        },
      },
      legend: {
        display: false,
      },
    },
  };
}

/**
 * Prepare heatmap data showing uptime/downtime over days and hours
 * This creates a 2D heatmap (day of week × hour of day)
 * @param results Monitoring results
 * @param timeRange Time range for filtering results
 * @param theme Material-UI theme
 * @returns Data for a heatmap visualization
 */
export function prepareDowntimeHeatmapData(
  results: MonitoringResult[],
  timeRange: TimeRange,
  theme: Theme,
) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const hours = Array.from(
    { length: 24 },
    (_, i) => `${i.toString().padStart(2, "0")}:00`,
  );

  // Create a 2D array for total checks and downtime counts
  // [day][hour]
  const totalChecks = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0));
  const downtimeCounts = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0));

  // Filter results by time range
  const filteredResults = filterResultsByTimeRange(results, timeRange);

  // Process each result
  filteredResults.forEach((result) => {
    const date = new Date(result.checkedAt);
    const day = date.getDay(); // 0-6
    const hour = date.getHours(); // 0-23

    totalChecks[day][hour]++;

    if (!result.isAvailable) {
      downtimeCounts[day][hour]++;
    }
  });

  // Calculate percentages and prepare data
  const data = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const total = totalChecks[day][hour];
      const downtime = downtimeCounts[day][hour];

      // Calculate percentage if we have data, otherwise null
      const percentage = total > 0 ? (downtime / total) * 100 : null;

      data.push({
        day: days[day],
        hour: hours[hour],
        value: percentage,
        total,
        downtime,
      });
    }
  }

  return { data, days, hours };
}
