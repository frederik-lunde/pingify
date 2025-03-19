import React from 'react';
import { Paper, Typography, Box, useTheme } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { MonitoringResult } from '../../types';
import { prepareChartData, getChartOptions } from '../../utils/chartUtils';

// Chart.js components are registered in the main WebsiteDetails component
// to avoid duplication of registration

interface ResponseTimeChartProps {
  results: MonitoringResult[];
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ results }) => {
  const theme = useTheme();
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Response Time History
      </Typography>
      <Box sx={{ height: 300 }}>
        {results.length > 0 ? (
          <Line 
            data={prepareChartData(results, theme)} 
            options={getChartOptions()} 
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

export default ResponseTimeChart;