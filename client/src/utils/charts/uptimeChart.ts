// src/utils/charts/uptimeCharts.ts
import { Theme } from '@mui/material';
import { ChartData, ChartOptions } from 'chart.js';
import { MonitoringResult } from '../../types';
import { TimeRange } from '../../components/website-details/TimeRangeSelector';
import { 
  filterResultsByTimeRange, 
  groupResultsByTime, 
  formatDateForTimeRange,
  getGradientColor,
  sortResultsByTime
} from './common';

/**
 * Prepares data for the uptime status chart
 * @param results Monitoring results
 * @param timeRange Selected time range
 * @param theme Material-UI theme
 * @returns Chart.js data object
 */
export function prepareUptimeStatusData(
  results: MonitoringResult[],
  timeRange: TimeRange,
  theme: Theme
): ChartData<'bar'> {
  if (!results || results.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }
  
  // Filter by time range
  const filteredResults = filterResultsByTimeRange(results, timeRange);
  
  // Determine appropriate grouping based on time range
  let groupBy: 'hour' | 'day' | 'week' | 'month';
  switch (timeRange) {
    case '1d':
      groupBy = 'hour';
      break;
    case '7d':
    case '30d':
      groupBy = 'day';
      break;
    case '365d':
    case 'all':
      groupBy = 'month';
      break;
    default:
      groupBy = 'day'; // Default fallback
  }
  
  // Group the results
  const groupedData = groupResultsByTime(filteredResults, groupBy);
  
  // Create labels and data
  const labels = groupedData.map(group => {
    // Format label based on group type
    const formatters = {
      'hour': (period: string) => {
        const date = new Date(period.replace(' ', 'T'));
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
      'day': (period: string) => {
        const date = new Date(period);
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      },
      'week': (period: string) => {
        const date = new Date(period);
        return `Week of ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
      },
      'month': (period: string) => {
        const date = new Date(period + '-01');
        return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
      }
    };
    
    // Use the appropriate formatter or fallback to a default
    return formatters[groupBy]?.(group.period) || new Date(group.period).toLocaleDateString();
  });
  
  // Create the uptime percentage dataset
  const uptimeData = groupedData.map(group => group.uptimePercentage);
  
  // Create the background colors based on uptime percentage
  const backgroundColors = groupedData.map(group => 
    getGradientColor(group.uptimePercentage, theme)
  );
  
  return {
    labels,
    datasets: [
      {
        label: 'Uptime (%)',
        data: uptimeData,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.8,
        maxBarThickness: 50,
        // Add raw data for tooltips with type assertion
        rawData: groupedData
      } as any
    ]
  };
}

/**
 * Gets chart options for the uptime status chart
 * @returns Chart.js options
 */
export function getUptimeStatusOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x', // Horizontal bars
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Uptime %'
        },
        ticks: {
          callback: function(value) {
            return value + '%';
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time Period'
        },
        grid: {
          offset: true
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const dataset = context.dataset;
            const index = context.dataIndex;
            const value = dataset.data[index] as number;
            return `Uptime: ${value.toFixed(2)}%`;
          },
          afterLabel: function(context) {
            // This assumes we've added the raw data to the dataset metadata
            const dataset = context.dataset as any;
            const index = context.dataIndex;
            const rawData = dataset.rawData?.[index];
            
            if (rawData) {
              return [
                `Total checks: ${rawData.total}`,
                `Available: ${rawData.available}`,
                `Unavailable: ${rawData.unavailable}`
              ];
            }
            return [];
          }
        }
      },
      legend: {
        display: false
      }
    }
  };
}

/**
 * Prepares data for uptime timeline chart (showing up/down status over time)
 * @param results Monitoring results
 * @param timeRange Selected time range
 * @param theme Material-UI theme
 * @returns Chart.js data object for a line chart with step interpolation
 */
export function prepareUptimeTimelineData(
  results: MonitoringResult[],
  timeRange: TimeRange,
  theme: Theme
): ChartData<'line'> {
  // Filter and sort results
  const filteredResults = filterResultsByTimeRange(results, timeRange);
  
  if (!filteredResults.length) {
    return { labels: [], datasets: [] };
  }
  
  // Sort by time (oldest first) - using the common utility function
  const sortedResults = sortResultsByTime(filteredResults);
  
  // Generate labels and data
  const labels = sortedResults.map(result => 
    formatDateForTimeRange(new Date(result.checkedAt), timeRange)
  );
  
  // Map availability to 1 (up) or 0 (down)
  const data = sortedResults.map(result => result.isAvailable ? 1 : 0);
  
  return {
    labels,
    datasets: [
      {
        label: 'Status',
        data,
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.main + '20', // Add some transparency
        fill: true,
        stepped: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        // Store raw data for tooltips with type assertion
        rawData: sortedResults
      } as any
    ]
  };
}

/**
 * Gets chart options for the uptime timeline chart
 * @returns Chart.js options
 */
export function getUptimeTimelineOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          callback: function(value) {
            return value === 1 ? 'Up' : 'Down';
          },
          stepSize: 1
        },
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw as number;
            return value === 1 ? 'Status: Online' : 'Status: Offline';
          },
          afterLabel: function(context) {
            // This assumes we've added the raw data to the dataset metadata
            const dataset = context.dataset as any;
            const index = context.dataIndex;
            const rawData = dataset.rawData?.[index];
            
            if (rawData) {
              const result = rawData as MonitoringResult;
              const lines = [];
              
              if (result.responseTime !== null) {
                lines.push(`Response time: ${result.responseTime}ms`);
              }
              
              if (result.statusCode !== null) {
                lines.push(`Status code: ${result.statusCode}`);
              }
              
              if (result.errorMessage) {
                lines.push(`Error: ${result.errorMessage}`);
              }
              
              return lines;
            }
            return [];
          }
        }
      }
    }
  };
}