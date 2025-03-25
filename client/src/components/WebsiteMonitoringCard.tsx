import React, { useMemo } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Chip, 
  useTheme, 
  useMediaQuery,
  Skeleton 
} from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  TooltipProps 
} from 'recharts';
import { 
  useWebsiteResults,
  useWebsiteStats
} from '../api/hooks/useMonitoring';
import { UserWebsite } from '../types';

interface WebsiteMonitoringCardProps {
  website: UserWebsite;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload;
  return (
    <Box sx={{ 
      backgroundColor: '#333', 
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      color: 'white'
    }}>
      <Typography variant="body2">
        <strong>{new Date(data.timestamp).toLocaleTimeString()}</strong>
      </Typography>
      <Typography variant="caption" color="#aaa">
        Response: {data.responseTime ? `${Math.round(data.responseTime)}ms` : 'N/A'}
      </Typography>
      <Box mt={0.5}>
        <Chip 
          label={data.isAvailable ? 'Online' : 'Offline'} 
          size="small" 
          sx={{ 
            backgroundColor: data.isAvailable ? '#4caf50' : '#f44336',
            color: 'white',
            height: 20
          }}
        />
        {data.statusCode && (
          <Typography variant="caption" color="#aaa" ml={1}>
            Code: {data.statusCode}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const WebsiteMonitoringCard: React.FC<WebsiteMonitoringCardProps> = ({ website }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Use monitoring hooks with fixed 1h time range
  const { results, loading: resultsLoading, error: resultsError, uptime } = 
    useWebsiteResults(website.websiteId, { range: '1h' });
  const { loading: statsLoading, error: statsError } = 
    useWebsiteStats(website.websiteId, { period: '1h' });
    
  const loading = resultsLoading || statsLoading;
  const error = resultsError || statsError;

  // Formatting functions
  const formatUptime = (value: number) => `${Math.min(value * 100, 100).toFixed(2)}%`;
  const formatResponseTime = (ms: number | null) => ms ? `${Math.round(ms)}ms` : 'N/A';
  const formatUrl = (url: string) => url.replace(/^https?:\/\//, '');

  // Prepare chart data - sorted chronologically (oldest to newest)
  const { chartData, minResponseTime, maxResponseTime } = useMemo(() => {
    if (!results || results.length === 0) return { chartData: [], minResponseTime: 0, maxResponseTime: 1000 };
    
    // Sort results by timestamp (oldest first)
    const sortedResults = [...results].sort((a, b) => 
      new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );

    const validResults = sortedResults.filter(r => r.responseTime !== null);
    const responseTimes = validResults.map(r => r.responseTime as number);
    
    const min = Math.max(0, Math.floor((Math.min(...responseTimes) * 0.9) || 0));
    const max = Math.ceil((Math.max(...responseTimes) * 1.1) || 1000);

    return {
      chartData: sortedResults.map(result => ({
        timestamp: new Date(result.checkedAt).getTime(),
        responseTime: result.responseTime,
        isAvailable: result.isAvailable,
        statusCode: result.statusCode
      })),
      minResponseTime: min,
      maxResponseTime: max
    };
  }, [results]);

  // Status calculations - use the newest result (last in the sorted array)
  const latestResult = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1] : null;
  }, [chartData]);

  const statusColor = useMemo(() => {
    if (!latestResult?.isAvailable) return '#f44336';
    if (!latestResult.statusCode) return '#4caf50';
    if (latestResult.statusCode >= 200 && latestResult.statusCode < 300) return '#4caf50';
    if (latestResult.statusCode >= 300 && latestResult.statusCode < 400) return '#ff9800';
    return '#f44336';
  }, [latestResult]);

  if (error) return (
    <Paper sx={{ 
      p: 2, 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e1e1e',
      color: 'error.main'
    }}>
      Error monitoring {website.website.url}
    </Paper>
  );

  return (
    <Paper sx={{ 
      p: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      backgroundColor: '#1e1e1e',
      minWidth: 250,
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        boxShadow: 3,
        transform: 'translateY(-2px)'
      }
    }}>
      {loading ? (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Skeleton variant="rectangular" width={80} height={24} />
            <Skeleton variant="rectangular" width={100} height={24} />
          </Box>
          <Skeleton variant="rectangular" height={150} sx={{ mt: 2 }} />
        </Box>
      ) : (
        <>
          {/* Header Section */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box sx={{ maxWidth: '70%' }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  color: '#fff',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {website.name || formatUrl(website.website.url)}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#bbb',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block'
                }}
              >
                {formatUrl(website.website.url)}
              </Typography>
            </Box>
            <Chip 
              label={`${website.interval}s`}
              size="small"
              sx={{ 
                backgroundColor: '#333',
                color: '#bbb',
                fontWeight: 'bold',
                fontSize: '0.65rem',
                height: 24
              }}
            />
          </Box>

          {/* Status Indicators */}
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip 
              label={latestResult?.isAvailable ? 'ONLINE' : 'OFFLINE'}
              size="small"
              sx={{ 
                backgroundColor: statusColor,
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 24
              }}
            />
            <Chip 
              label={formatResponseTime(latestResult?.responseTime ?? null)}
              size="small"
              sx={{ 
                backgroundColor: '#2196f3',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 24
              }}
            />
            <Chip 
              label={`${formatUptime(uptime)} UPTIME`}
              size="small"
              sx={{ 
                backgroundColor: uptime > 0.95 
                  ? '#4caf50' 
                  : uptime > 0.9 
                  ? '#ff9800' 
                  : '#f44336',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 24
              }}
            />
          </Box>

          {/* Chart Section */}
          <Box sx={{ flex: 1, minHeight: 120 }}>
            {chartData.length === 0 ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <Typography variant="caption" color="text.secondary">
                  No monitoring data
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <YAxis 
                    domain={[minResponseTime, maxResponseTime]}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${value}ms`}
                    width={40}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(time) => {
                      const date = new Date(time);
                      return date.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false // Use 24-hour format for more space
                      });
                    }}
                    interval={Math.ceil(chartData.length / 5)} // Show ~5 ticks
                    angle={isSmallScreen ? -45 : 0} // Rotate on small screens
                    dx={isSmallScreen ? -10 : 0} // Adjust position
                    height={isSmallScreen ? 40 : 30} // More height for rotated labels
                  />
                  <Line
                    dataKey="responseTime"
                    dot={false}
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    isAnimationActive={!isSmallScreen}
                  />
                  <RechartsTooltip 
                    content={<CustomTooltip />}
                    cursor={{ strokeDasharray: '3 3' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default WebsiteMonitoringCard;