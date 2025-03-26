// client/src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import { MonitoringResult, UserWebsite } from '../../types';
import { getStatusColor, getResponseTimeColor, formatResponseTime, formatUptime } from '../../utils/statusUtils';
import { prepareCardChartData, getCardChartOptions } from '../../utils/chartUtils';

// Import just what we need from chart.js
import {
  Chart as ChartJS,
  Filler,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip
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

interface WebsiteCardProps {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  results: MonitoringResult[];
  loading?: boolean;
}

// Create a component for the chart to optimize rendering
const ResponseTimeChart = React.memo(({ data, options }: { data: any, options: any }) => {
  return <Line data={data} options={options} />;
});

const WebsiteCard = React.memo(({
  userWebsite,
  latestResult,
  results,
  loading = false,
}: WebsiteCardProps) => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Calculate uptime percentage
  const uptime = useMemo(() => {
    if (!results || results.length === 0) return 100;
    const total = results.length;
    const available = results.filter(r => r.isAvailable).length;
    return (available / total) * 100;
  }, [results]);
  
  const uptimeColor = getStatusColor(uptime);

  // Use chartUtils to prepare chart data - now with proper memoization
  const chartData = useMemo(() => {
    if (!results || results.length === 0) return null;
    return prepareCardChartData(results, theme, 10);
  }, [results, theme]);
  
  // Determine loading status for UI
  const showLoading = loading && !results.length;
  const showChart = results.length > 0 && chartData;

  // Memoize event handlers to prevent unnecessary rerenders
  const handleClick = useCallback(() => {
    navigate(`/website/${userWebsite.websiteId}`);
  }, [navigate, userWebsite.websiteId]);

  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    navigate(`/website/${userWebsite.websiteId}/settings`);
  }, [navigate, userWebsite.websiteId]);
  
  // Use chartUtils for options - memoized
  const chartOptions = useMemo(() => getCardChartOptions(), []);

  // Calculate status information - memoized
  const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
  const statusColor = isOnline ? 'success' : 'error';
  const responseTime = latestResult?.responseTime ?? 0;
  const responseTimeColor = getResponseTimeColor(responseTime);
  const statusCode = latestResult?.statusCode;
  
  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }} 
      onClick={handleClick}
    >
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header with website name and action buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div" noWrap>
            {userWebsite.name}
          </Typography>
          <Box>
            <Tooltip title="Website Settings">
              <IconButton 
                size="small" 
                onClick={handleSettingsClick}
                sx={{ mr: 0.5 }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* URL display */}
        <Typography 
          variant="body2" 
          color="textSecondary" 
          noWrap 
          sx={{ mb: 2 }}
        >
          {userWebsite.website.url}
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip
            size="small"
            icon={isOnline ? <CheckIcon /> : <ErrorIcon />}
            label={isOnline ? 'Online' : 'Offline'}
            color={statusColor}
          />
          
          <Chip
            size="small"
            label={`${statusCode || 'N/A'}`}
            color={isOnline ? 'info' : 'default'}
          />
          
          <Chip
            size="small"
            label={formatResponseTime(responseTime)}
            color={responseTimeColor}
          />
          
          <Chip
            size="small"
            label={formatUptime(uptime)}
            color={uptimeColor}
          />
        </Box>

        {/* Response time chart */}
        <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 120, mt: 'auto' }}>
          {showLoading ? (
            <Box 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <CircularProgress size={24} />
            </Box>
          ) : showChart ? (
            <ResponseTimeChart 
              data={chartData} 
              options={chartOptions} 
              key={`chart-${userWebsite.websiteId}`} 
            />
          ) : (
            <Box 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Typography variant="body2" color="textSecondary">
                No data available
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});

export default WebsiteCard;