// client/src/components/dashboard/WebsiteCard.tsx
import React from 'react';
import { useNavigate } from 'react-router';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import { MonitoringResult, UserWebsite } from '../../types';
import { getStatusColor, getResponseTimeColor, formatResponseTime, formatUptime } from '../../utils/statusUtils';

// Import just what we need from chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
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
  onDelete?: (websiteId: number) => void;
}

const WebsiteCard: React.FC<WebsiteCardProps> = ({
  userWebsite,
  latestResult,
  results,
  onDelete
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleClick = () => {
    navigate(`/website/${userWebsite.websiteId}`);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    navigate(`/website/${userWebsite.websiteId}/settings`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onDelete) {
      onDelete(userWebsite.websiteId);
    }
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    const data = [...results].reverse().slice(0, 10); // Get the last 10 results
    
    return {
      labels: data.map(r => new Date(r.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        {
          data: data.map(r => r.responseTime || 0),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.main + '33', // Add transparency
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2
        }
      ]
    };
  }, [results, theme.palette.primary.main]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // Hide legend
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false
      }
    },
    scales: {
      x: {
        display: false // Hide x-axis
      },
      y: {
        display: false // Hide y-axis
      }
    }
  };

  // Determine status information
  const isOnline = latestResult?.isAvailable ?? false;
  const statusColor = isOnline ? 'success' : 'error';
  const responseTime = latestResult?.responseTime ?? 0;
  const responseTimeColor = getResponseTimeColor(responseTime);
  const statusCode = latestResult?.statusCode;
  
  // Calculate uptime percentage
  const uptime = React.useMemo(() => {
    if (!results.length) return 100;
    const total = results.length;
    const available = results.filter(r => r.isAvailable).length;
    return (available / total) * 100;
  }, [results]);
  
  const uptimeColor = getStatusColor(uptime);

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
            <Tooltip title="Remove Website">
              <IconButton 
                size="small" 
                onClick={handleDeleteClick}
                color="error"
              >
                <DeleteIcon fontSize="small" />
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
        <Box sx={{ flexGrow: 1, minHeight: 100, mt: 'auto' }}>
          {results.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
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
};

export default WebsiteCard;