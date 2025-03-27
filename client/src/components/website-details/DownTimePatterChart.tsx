// src/components/website-details/DowntimePatternChart.tsx
import React, { useMemo, useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  useTheme, 
  Skeleton, 
  ToggleButtonGroup, 
  ToggleButton 
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import { MonitoringResult } from '../../types';
import { 
  prepareDowntimeByHourData, 
  getDowntimeByHourOptions,
  prepareDowntimeByWeekdayData,
  getDowntimeByWeekdayOptions
} from '../../utils/charts/downTimeChart';
import { TimeRange } from './TimeRangeSelector';

// Import required chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type PatternType = 'hour' | 'weekday';

interface DowntimePatternChartProps {
  results: MonitoringResult[];
  timeRange: TimeRange;
  loading?: boolean;
  height?: number;
  title?: string;
}

const DowntimePatternChart: React.FC<DowntimePatternChartProps> = ({ 
  results, 
  timeRange,
  loading = false,
  height = 300,
  title = "Downtime Patterns"
}) => {
  const theme = useTheme();
  const [patternType, setPatternType] = useState<PatternType>('hour');
  
  // Memoize chart data and options for better performance
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;
    
    return patternType === 'hour' 
      ? prepareDowntimeByHourData(results, timeRange, theme)
      : prepareDowntimeByWeekdayData(results, timeRange, theme);
  }, [results, timeRange, theme, patternType]);
  
  const chartOptions = useMemo(() => {
    return patternType === 'hour'
      ? getDowntimeByHourOptions()
      : getDowntimeByWeekdayOptions();
  }, [patternType]);
  
  // Handle pattern type change
  const handlePatternTypeChange = (_event: React.MouseEvent<HTMLElement>, newType: PatternType | null) => {
    if (newType !== null) {
      setPatternType(newType);
    }
  };
  
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {title}
        </Typography>
        
        <ToggleButtonGroup
          value={patternType}
          exclusive
          onChange={handlePatternTypeChange}
          aria-label="Pattern type"
          size="small"
        >
          <ToggleButton value="hour" aria-label="By hour">
            By Hour
          </ToggleButton>
          <ToggleButton value="weekday" aria-label="By weekday">
            By Day
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      <Box sx={{ height }}>
        {results && results.length > 0 && chartData ? (
          <Bar 
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
export default React.memo(DowntimePatternChart);