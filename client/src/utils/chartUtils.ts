import { MonitoringResult } from '../types';
import { ChartOptions } from 'chart.js';
import { Theme } from '@mui/material';

export const prepareChartData = (monitoringResults: MonitoringResult[], theme: Theme) => {
  // Create a reversed copy of results to show oldest first
  const chartData = [...monitoringResults].reverse().slice(0, 20);
  
  return {
    labels: chartData.map(r => new Date(r.checkedAt).toLocaleTimeString()),
    datasets: [
      {
        label: 'Response Time (ms)',
        data: chartData.map(r => r.responseTime || 0),
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.light,
        fill: false,
        tension: 0.1
      }
    ]
  };
};

export const getChartOptions = (): ChartOptions<'line'> => {
  return {
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
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Response Time History'
      }
    }
  };
};