import React from 'react';
import { Paper, Typography, Box, Chip, Tooltip } from '@mui/material';
import { MonitoringResult, UserWebsite } from '../types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, TooltipProps } from 'recharts';

interface WebsiteMonitoringCardProps {
  website: UserWebsite;
  results: MonitoringResult[];
  latestResult?: MonitoringResult;
  stats?: {
    uptime?: number;
    averageResponseTime?: number;
    consecutiveFailures?: number;
  };
}

// Custom tooltip component for the chart
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ 
        backgroundColor: '#333', 
        border: '1px solid #666',
        padding: '8px', 
        borderRadius: '4px',
        color: 'white',
        fontSize: '12px'
      }}>
        <p style={{ margin: '0 0 4px 0' }}><b>Time:</b> {label}</p>
        <p style={{ margin: '0 0 4px 0' }}><b>Response:</b> {data.responseTime ? `${data.responseTime}ms` : 'N/A'}</p>
        <p style={{ margin: '0' }}><b>Status:</b> {data.isAvailable ? 'Online' : 'Offline'}</p>
      </div>
    );
  }
  return null;
};

const WebsiteMonitoringCard: React.FC<WebsiteMonitoringCardProps> = ({ 
  website, 
  results,
  latestResult,
  stats
}) => {
  const isOnline = latestResult?.isAvailable ?? true;
  const responseTime = latestResult?.responseTime;
  const statusCode = latestResult?.statusCode;
  
  // Format URL for display (removing https:// prefix)
  const displayUrl = website.website.url.replace(/^https?:\/\//, '');
  const displayName = website.name || displayUrl;
  
  // Prepare data for the chart - last 8 measurements in reverse chronological order
  const chartData = [...results]
    .slice(0, 8)
    .reverse()
    .map(result => ({
      time: new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      responseTime: result.responseTime,
      isAvailable: result.isAvailable,
      statusCode: result.statusCode
    }));
  
  // Calculate min and max values for the y-axis scaling from actual data
  const responseTimesArray = chartData
    .map(r => r.responseTime)
    .filter((time): time is number => time !== null && !isNaN(time));
  
  // Get actual min and max from data with fallbacks if empty
  const actualMin = responseTimesArray.length > 0 ? Math.min(...responseTimesArray) : 0;
  const actualMax = responseTimesArray.length > 0 ? Math.max(...responseTimesArray) : 500;
  
  // Add some padding to the min and max to avoid line touching edges
  const minResponseTime = Math.max(0, Math.floor(actualMin * 0.9));
  const maxResponseTime = Math.ceil(actualMax * 1.1);
  
  

  // Helper function to determine status color
  const getStatusColor = (code: number | null, isAvailable: boolean) => {
    if (!isAvailable) return '#f44336'; // Red for unavailable
    if (!code) return '#4caf50'; // Green for available but no code
    if (code >= 200 && code < 300) return '#4caf50'; // Green for 2xx
    if (code >= 300 && code < 400) return '#ff9800'; // Orange for 3xx
    if (code >= 400) return '#f44336'; // Red for 4xx/5xx
    return '#4caf50'; // Default to green
  };
  
  // Determine status text
  const getStatusText = () => {
    if (!isOnline) return "OFFLINE";
    if (statusCode) return `ONLINE (${statusCode})`;
    return "ONLINE";
  };
  
  return (
    <Paper 
      sx={{ 
        p: 2, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#1e1e1e', 
        color: 'white',
        borderRadius: 1
      }}
    >
      {/* Website URL and Name */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: '#fff', opacity: 0.9, mb: 0 }}>
            {displayName}
          </Typography>
          <Typography variant="body2" sx={{ color: '#bbb', mb: 1 }}>
            {displayUrl}
          </Typography>
        </Box>
        
        {/* Monitoring Interval */}
        <Tooltip title="Check interval">
          <Chip 
            label={`${website.interval}s`}
            size="small" 
            sx={{ 
              backgroundColor: '#333',
              color: '#bbb',
              fontWeight: 'bold',
              borderRadius: 1,
              fontSize: '0.7rem',
              height: 24
            }}
          />
        </Tooltip>
      </Box>
      
      {/* Status indicators */}
      <Box display="flex" gap={1} mb={2} mt={1}>
        <Chip 
          label={getStatusText()}
          size="small" 
          sx={{ 
            backgroundColor: getStatusColor(statusCode, isOnline),
            color: 'white',
            fontWeight: 'bold',
            borderRadius: 1,
            fontSize: '0.7rem',
            height: 24
          }}
        />
        <Chip 
            label={responseTime ? `${responseTime}ms` : 'N/A'}
            size="small" 
            sx={{ 
              backgroundColor: '#2196f3',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: 1,
              fontSize: '0.7rem',
              height: 24
            }}
          />
        {stats?.uptime !== undefined && (
          <Chip 
            label={`${Math.round(stats.uptime * 100)}% UPTIME`}
            size="small" 
            sx={{ 
              backgroundColor: stats.uptime > 0.95 ? '#4caf50' : stats.uptime > 0.9 ? '#ff9800' : '#f44336',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: 1,
              fontSize: '0.7rem',
              height: 24
            }}
          />
        )}
      </Box>
      <Box> 
        <ResponsiveContainer height={150} width={335}> 
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <YAxis 
              domain={[minResponseTime, maxResponseTime]}
              tick={true}
              axisLine={false}
              tickLine={false}
            />
            <Line 
              type="monotone" 
              dataKey="responseTime" 
              stroke="#2196f3" 
              strokeWidth={2} 
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.responseTime === null) return null;
                
                return (
                  <circle 
                    cy={cy} 
                    cx={cx} 
                    r={4} 
                    fill={payload.isAvailable ? '#2196f3' : '#f44336'} 
                  />
                );
              }}
              isAnimationActive={false}
              connectNulls={true}
              activeDot={{ r: 6, fill: '#fff', stroke: '#2196f3' }}
            />
            <XAxis 
              dataKey="time" 
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <RechartsTooltip content={<CustomTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default WebsiteMonitoringCard;