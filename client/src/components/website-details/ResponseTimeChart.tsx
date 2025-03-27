// src/components/website-details/ResponseTimeChart.tsx
import React, { useMemo } from 'react';
import { Paper, Typography, Box, useTheme, Skeleton } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { MonitoringResult, TimeRange } from '../../types';
import { filterResultsByTimeRange, formatDateForTimeRange } from '../../utils/charts/common';

// Import just what we need from chart.js
import {
  Chart as ChartJS,
  Filler,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  TooltipItem
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  Filler,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip
);

interface ResponseTimeChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange; // Changed from optional to required
  loading?: boolean;
  height?: number;
  title?: string;
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ 
  results, 
  timeRange,
  loading = false,
  height = 300,
  title = "Response Time History"
}) => {
  const theme = useTheme();
  
  // Create sorted results for both chart data and tooltips
  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return [];
    // Filter by time range
    const filteredResults = filterResultsByTimeRange(results, timeRange);
    // Sort by time (oldest first)
    return [...filteredResults].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );
  }, [results, timeRange]);
  
  // Prepare chart data based on sorted results
  const chartData = useMemo(() => {
    if (!sortedResults || sortedResults.length === 0) return null;
    
    // Prepare data
    return {
      labels: sortedResults.map(result => 
        formatDateForTimeRange(new Date(result.checkedAt), timeRange)
      ),
      datasets: [
        {
          label: 'Response Time (ms)',
          data: sortedResults.map(result => result.responseTime || 0),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.main + '20', // with transparency
          fill: true,
          tension: 0.1,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    };
  }, [sortedResults, timeRange, theme]);
  
  // Memoize chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Response Time (ms)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        },
        ticks: {
          maxRotation: 30,
          minRotation: 30
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems: TooltipItem<'line'>[]) {
            const index = tooltipItems[0].dataIndex;
            if (sortedResults && sortedResults[index]) {
              return new Date(sortedResults[index].checkedAt).toLocaleString();
            }
            return '';
          }
        }
      }
    }
  }), [sortedResults]);

  // Show loading state
  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ height }}>
          <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />
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
          <Line 
            data={chartData} 
            options={chartOptions} 
          />
        ) : (
          <Box display="flex" height="100%" alignItems="center" justifyContent="center">
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
export default React.memo(ResponseTimeChart);