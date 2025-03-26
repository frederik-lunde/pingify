//client\src\pages\WebsiteDetails.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router';
import { 
  Container, 
  Box, 
  CircularProgress, 
  Typography, 
  Button, 
  Paper,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  ErrorOutline as ErrorIcon, 
  Refresh as RefreshIcon
} from '@mui/icons-material';

// Chart.js registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// Import our new domain hook
import { useWebsiteDetail } from '../hooks';

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
  ChartTooltip,
  Legend
);

const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const id = params.id;
  const websiteId = parseInt(id || '0', 10);
  
  // UI State
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  
  // Use our new hook to manage the website details
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
    userWebsite,
    uptime,
    avgResponseTime
  } = useWebsiteDetail(websiteId);

  // Safe versions of the data for TypeScript
  const safeResults = results || [];
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Loading state
  if (loading && !safeResults.length) {
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
      <ResponseTimeChart results={safeResults} />

      {/* Recent Checks Table */}
      <ResultsTable results={safeResults} />

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WebsiteDetails;