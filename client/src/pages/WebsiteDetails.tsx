//client\src\pages\WebsiteDetails.tsx
import React from 'react';
import { useParams } from 'react-router';
import { Container, Box, CircularProgress, Typography, Button, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

// Chart.js registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Custom hook
import { useWebsiteDetail } from '../hooks/useWebsiteDetail';

// Component imports
import WebsiteHeader from '../components/website-details/WebsiteHeader';
import WebsiteStatsCards from '../components/website-details/WebsiteStatsCards';
import ResponseTimeChart from '../components/website-details/ResponseTimeChart';
import ResultsTable from '../components/website-details/ResultsTable';

// Register Chart.js components once
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
  
  // Use our custom hook to manage the website details
  const { 
    results, 
    loading, 
    error, 
    isChecking, 
    handleCheckNow, 
    latestResult, 
    currentStatus, 
    statusColor,
    refetch,
    userWebsite  // Added userWebsite from updated hook
  } = useWebsiteDetail(websiteId);

  // Loading state
  if (loading && !results.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Error state
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

  // No access state
  if (!userWebsite) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon color="error" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h5" color="error">
            Website Not Found
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            This website doesn't exist or you don't have access to it.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header with status and check button - updated to use userWebsite */}
      <WebsiteHeader 
        userWebsite={userWebsite}
        currentStatus={currentStatus}
        statusColor={statusColor}
        isChecking={isChecking}
        onCheckNow={handleCheckNow}
      />

      {/* Stats Cards */}
      <WebsiteStatsCards latestResult={latestResult} />

      {/* Response Time Chart */}
      <ResponseTimeChart results={results} />

      {/* Recent Checks Table */}
      <ResultsTable results={results} />
    </Container>
  );
};

export default WebsiteDetails;