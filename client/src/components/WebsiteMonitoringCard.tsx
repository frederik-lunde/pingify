import React from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { MonitoringResult, UserWebsite } from '../types';
import { LineChart, Line, XAxis } from 'recharts';

interface WebsiteMonitoringCardProps {
  website: UserWebsite;
  results: MonitoringResult[];
  isOnline?: boolean;
  responseTime?: number | null;
}

const WebsiteMonitoringCard: React.FC<WebsiteMonitoringCardProps> = ({ 
  website, 
  results,
  isOnline = true,
  responseTime = null,
}) => {
  // Format URL for display (removing https:// prefix)
  const displayUrl = website.website.url.replace(/^https?:\/\//, '');
  
  // Prepare data for the chart - last 6 measurements in reverse chronological order
  const chartData = [...results]
    .slice(0, 6)
    .reverse()
    .map(result => ({
      time: new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      responseTime: result.responseTime
    }));
  
  // Calculate min and max values for the y-axis scaling
  const responseTimesArray = results.map(r => r.responseTime).filter(Boolean) as number[];
  const minResponseTime = Math.floor(Math.min(...responseTimesArray, 150) / 50) * 50; // Default minimum of 150ms
  const maxResponseTime = Math.ceil(Math.max(...responseTimesArray, 500) / 50) * 50; // Default maximum of 500ms
  
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
      {/* Website URL */}
      <Typography variant="h6" gutterBottom sx={{ color: '#fff', opacity: 0.9 }}>
        {displayUrl}
      </Typography>
      
      {/* Status indicators */}
      <Box display="flex" gap={1} mb={2}>
        <Chip 
          label="ONLINE" 
          size="small" 
          sx={{ 
            backgroundColor: isOnline ? '#4caf50' : '#f44336',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: 1,
            fontSize: '0.7rem',
            height: 24
          }}
        />
        {responseTime && (
          <Chip 
            label={`${responseTime}MS`}
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
        )}
      </Box>
      
      {/* Response time chart */}
      <Box mt="auto" display="flex">
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 80, color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', mb: 1, ml: 1 }}>
          <Box>{maxResponseTime}ms</Box>
          <Box>{minResponseTime}ms</Box>
        </Box>

        <LineChart
          width={300}
          height={100}
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          <Line 
            type="monotone" 
            dataKey="responseTime" 
            stroke="#2196f3" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
          />
          <XAxis 
            dataKey="time" 
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} 
            axisLine={false} 
            tickLine={false} 
          />
        </LineChart>
      </Box>
    </Paper>
  );
};

export default WebsiteMonitoringCard;