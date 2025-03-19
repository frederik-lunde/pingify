import React, { useState } from 'react';
import { useParams } from 'react-router';
import { 
  useWebsiteResults, 
  triggerWebsiteCheck 
} from '../services/monitoringService';
import { MonitoringResult } from '../types';

// MUI Components
import {
  Container,
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  useTheme
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// Chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);



const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const id = params.id;
  const websiteId = parseInt(id || '0', 10);
  const [isChecking, setIsChecking] = useState(false);
  const theme = useTheme();
  
  // Use the polling hook for this specific website's results
  const { 
    results, 
    loading, 
    error, 
    refetch 
  } = useWebsiteResults(websiteId, 50);

  // Handle manual check button click
  const handleCheckNow = async (): Promise<void> => {
    try {
      setIsChecking(true);
      await triggerWebsiteCheck(websiteId);
      // Immediately refetch results to show the new check
      await refetch();
    } catch (err) {
      console.error('Error triggering check:', err);
    } finally {
      setIsChecking(false);
    }
  };

  // Prepare chart data
  const prepareChartData = (monitoringResults: MonitoringResult[]) => {
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
  
  // Chart options
  const chartOptions: ChartOptions<'line'> = {
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

  if (loading && !results.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon color="error" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h5" color="error">
            Error Loading Data
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            {error.message}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => refetch()}
            startIcon={<RefreshIcon />}
            sx={{ mt: 3 }}
          >
            Try Again
          </Button>
        </Paper>
      </Container>
    );
  }

  // Get current status from most recent result
  const latestResult = results && results.length > 0 ? results[0] : null;
  const websiteName = `Website #${websiteId}`;
  const currentStatus = latestResult?.isAvailable ? 'Online' : 'Offline';
  const statusColor = latestResult?.isAvailable ? 'success' : 'error';

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" component="h1">
              {websiteName}
            </Typography>
            {latestResult && (
              <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                {`ID: ${websiteId}`}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Chip 
              icon={latestResult?.isAvailable ? <CheckIcon /> : <ErrorIcon />}
              label={currentStatus}
              color={statusColor}
              sx={{ mr: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleCheckNow}
              disabled={isChecking}
              startIcon={isChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
            >
              {isChecking ? 'Checking...' : 'Check Now'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Response Time
              </Typography>
              <Typography variant="h5" component="div">
                {latestResult?.responseTime ? `${latestResult.responseTime}ms` : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Status Code
              </Typography>
              <Typography variant="h5" component="div">
                {latestResult?.statusCode || 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Last Checked
              </Typography>
              <Typography variant="h5" component="div">
                {latestResult?.checkedAt 
                  ? new Date(latestResult.checkedAt).toLocaleTimeString() 
                  : 'Never'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Response Time Chart */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Response Time History
        </Typography>
        <Box sx={{ height: 300 }}>
          {results.length > 0 ? (
            <Line 
              data={prepareChartData(results)} 
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

      {/* Recent Checks Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Checks
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Response Time</TableCell>
                <TableCell>Status Code</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results && results.map(result => (
                <TableRow key={result.id} sx={{ 
                  backgroundColor: result.isAvailable ? 'transparent' : theme.palette.error.light + '20'
                }}>
                  <TableCell>{new Date(result.checkedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip 
                      size="small"
                      label={result.isAvailable ? 'Up' : 'Down'}
                      color={result.isAvailable ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>{result.responseTime ? `${result.responseTime}ms` : 'N/A'}</TableCell>
                  <TableCell>{result.statusCode || 'N/A'}</TableCell>
                  <TableCell>{result.errorMessage || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default WebsiteDetails;