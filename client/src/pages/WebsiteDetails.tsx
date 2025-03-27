// src/pages/WebsiteDetails.tsx
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
  Alert,
  Tabs,
  Tab
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
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// Import our enhanced domain hook
import { useWebsiteDetail } from '../hooks/domain/useWebsiteDetail';

// Component imports
import WebsiteHeader from '../components/website-details/WebsiteHeader';
import WebsiteStatsCards from '../components/website-details/WebsiteStatsCards';
import ResponseTimeChart from '../components/website-details/ResponseTimeChart';
import UptimeChart from '../components/website-details/UptimeChart';
import DowntimePatternChart from '../components/website-details/DownTimePatternChart';
import ResultsTable from '../components/website-details/ResultsTable';
import TimeRangeSelector, { TimeRange } from '../components/website-details/TimeRangeSelector';

// Register Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend
);

// Tab panel interface
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab panel component
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`website-details-tabpanel-${index}`}
      aria-labelledby={`website-details-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const id = params.id;
  const websiteId = parseInt(id || '0', 10);
  
  // UI State
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  
  // Define available time range options per tab
  const getAvailableTimeRanges = (tabIndex: number): TimeRange[] => {
    switch (tabIndex) {
      case 0: // Response Time tab
      case 1: // Uptime Status tab
        return ['1d', '7d', '30d', '365d', 'all'];
      case 2: // Downtime Patterns tab
        return ['1d', '7d', '30d']; // Only show day, week, month options for pattern analysis
      case 3: // Recent Checks tab
        return ['1d', '7d', '30d', '365d', 'all'];
      default:
        return ['1d', '7d', '30d', '365d', 'all'];
    }
  };
  
  // Use our enhanced hook to manage the website details
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
    avgResponseTime,
    timeRange,
    setTimeRange
  } = useWebsiteDetail(websiteId);

  // Safe versions of the data for TypeScript
  const safeResults = results || [];
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    
    // Get available time ranges for this tab
    const availableRanges = getAvailableTimeRanges(newValue);
    
    // If current timeRange isn't available in this tab, reset to default
    if (!availableRanges.includes(timeRange)) {
      setTimeRange(availableRanges[0]);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
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

      {/* Time Range Selector */}
      <TimeRangeSelector 
        value={timeRange} 
        onChange={handleTimeRangeChange}
        availableRanges={getAvailableTimeRanges(activeTab)}
      />

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          aria-label="Website monitoring tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Response Time" />
          <Tab label="Uptime Status" />
          <Tab label="Downtime Patterns" />
          <Tab label="Recent Checks" />
        </Tabs>

        {/* Tab Content */}
        <TabPanel value={activeTab} index={0}>
          <ResponseTimeChart results={safeResults} timeRange={timeRange} />
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <UptimeChart 
            results={safeResults} 
            timeRange={timeRange} 
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <DowntimePatternChart 
            results={safeResults} 
            timeRange={timeRange} 
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={3}>
          <ResultsTable results={safeResults} limit={20} />
        </TabPanel>
      </Paper>

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