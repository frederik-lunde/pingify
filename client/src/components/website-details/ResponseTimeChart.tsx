import React, { useMemo } from 'react';
import { Paper, Typography, Box, useTheme, Skeleton } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { MonitoringResult } from '../../types';
import { prepareDetailedChartData, getDetailedChartOptions } from '../../utils/chartUtils';

interface ResponseTimeChartProps {
  results: MonitoringResult[];
  loading?: boolean;
  height?: number;
  title?: string;
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ 
  results, 
  loading = false,
  height = 300,
  title = "Response Time History"
}) => {
  const theme = useTheme();
  
  // Memoize chart data and options for better performance
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;
    return prepareDetailedChartData(results, theme, 20);
  }, [results, theme]);
  
  const chartOptions = useMemo(() => getDetailedChartOptions(), []);

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