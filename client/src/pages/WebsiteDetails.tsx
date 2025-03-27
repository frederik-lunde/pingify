// src/pages/WebsiteDetails.tsx
import React, { useState, useCallback } from "react";
import { useParams } from "react-router";
import {
  Container,
  Box,
  CircularProgress,
  Typography,
  Button,
  Paper,
  Snackbar,
  Alert,
} from "@mui/material";
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from "@mui/icons-material";

// Global Chart.js registration (if not done in App.tsx)
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip as ChartTooltip, Legend, Filler
} from "chart.js";
ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    Title, ChartTooltip, Legend, Filler // Ensure Filler is registered if used
);

// Import the hook
import { useWebsiteDetail } from "../hooks/domain/useWebsiteDetail"; // Corrected hook name

// Component imports
import WebsiteHeader from "../components/website-details/WebsiteHeader"; // Assuming exists
import WebsiteStatsCards from "../components/website-details/WebsiteStatsCards"; // Assuming exists
import ResponseTimeChart from "../components/website-details/ResponseTimeChart";
import UptimeChart from "../components/website-details/UptimeChart";
import DowntimePatternChart from "../components/website-details/DownTimePatternChart";
import ResultsTable from "../components/website-details/ResultsTable";
import TimeRangeSelector from "../components/website-details/TimeRangeSelector";
import WebsiteDetailsTabs from "../components/website-details/WebsiteDetailsTabs"; // Import the new Tabs component
import { TimeRange } from "../types"; // Import TimeRange

// Helper function for available ranges
const getAvailableTimeRanges = (tabIndex: number): TimeRange[] => {
  switch (tabIndex) {
    case 0: // Response Time
    case 1: // Uptime Status
    case 3: // Recent Checks
      return ["1d", "7d", "30d", "365d", "all"];
    case 2: // Downtime Patterns
      return ["1d", "7d", "30d", "365d"]; // Adjust as needed, maybe 'all' is too much for patterns
    default:
      return ["1d", "7d", "30d", "365d", "all"];
  }
};


const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const websiteId = parseInt(params.id || "0", 10);

  // State for active tab index
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>(""); // Keep for potential feedback

  // Use the central hook for data fetching and time range state
  const {
    userWebsite,
    results, // These are now filtered by the hook based on its timeRange state
    loading,
    error,
    isChecking,
    handleCheckNow,
    currentStatus,
    statusColor,
    refetch,
    // latestResult, // Can be used in stats cards
    // uptime, avgResponseTime, // Can be used in stats cards
    timeRange,     // Get current timeRange from hook
    setTimeRange,  // Get setter from hook
  } = useWebsiteDetail(websiteId); // Use default initial time range ('7d')

  // Available ranges based on current tab
  const availableRanges = getAvailableTimeRanges(activeTabIndex);

  // Callback for when the tab changes
  const handleTabChange = useCallback((newTabIndex: number) => {
    setActiveTabIndex(newTabIndex);
    // Check if the current timeRange is valid for the new tab
    const newAvailableRanges = getAvailableTimeRanges(newTabIndex);
    if (!newAvailableRanges.includes(timeRange)) {
      // If not valid, reset to the first available range for that tab
      setTimeRange(newAvailableRanges[0]);
    }
  }, [timeRange, setTimeRange]); // Dependency on timeRange and setTimeRange

   // Handle time range change from the selector
   // This directly calls the setter provided by the hook
  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
  }, [setTimeRange]);

  const handleSnackbarClose = () => setSnackbarOpen(false);

  // --- Render Logic ---

  // Loading State (Initial Load)
  if (loading && !results.length && !userWebsite) { // More precise initial loading check
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Error State
  if (error && !userWebsite) { // Show error primarily if website data failed
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <ErrorIcon color="error" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h5" color="error">Error Loading Website Details</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>{error.message}</Typography>
          <Button variant="contained" onClick={() => refetch()} startIcon={<RefreshIcon />} sx={{ mt: 3 }}>
            Try Again
          </Button>
        </Paper>
      </Container>
    );
  }

  // Not Found / No Access State
  if (!userWebsite && !loading) { // Ensure it's not shown during initial load
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <ErrorIcon color="info" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h5">Website Not Found</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            This website doesn't exist or you don't have access to it.
          </Typography>
        </Paper>
      </Container>
    );
  }

  // Main Content Render
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {userWebsite && ( // Render header only if userWebsite data is available
        <WebsiteHeader
          userWebsite={userWebsite}
          currentStatus={currentStatus}
          statusColor={statusColor}
          isChecking={isChecking}
          onCheckNow={handleCheckNow}
        />
      )}

      {/* Pass relevant stats if needed */}
      {/* <WebsiteStatsCards latestResult={latestResult} uptime={uptime} avgResponseTime={avgResponseTime} /> */}
      <WebsiteStatsCards latestResult={results.length > 0 ? results[0] : null} /> {/* Example: pass latest from filtered */}


      <TimeRangeSelector
        value={timeRange}
        onChange={handleTimeRangeChange}
        availableRanges={availableRanges} // Pass dynamic ranges
      />

      {/* Render Tabs and pass chart components */}
      <WebsiteDetailsTabs
         onTabChange={handleTabChange} // Pass tab change handler
         responseTimeChart={
            <ResponseTimeChart
                results={results}
                timeRange={timeRange}
                loading={loading && activeTabIndex === 0} // Pass loading/error specific to this chart
                error={error && activeTabIndex === 0 ? error : null}
             />
         }
         uptimeChart={
             <UptimeChart
                results={results}
                timeRange={timeRange}
                loading={loading && activeTabIndex === 1}
                error={error && activeTabIndex === 1 ? error : null}
             />
         }
         downtimePatternChart={
             <DowntimePatternChart
                results={results}
                timeRange={timeRange}
                loading={loading && activeTabIndex === 2}
             />
         }
         resultsTable={
             <ResultsTable
                results={results}
                timeRange={timeRange} // Pass timeRange for filtering
                loading={loading && activeTabIndex === 3}
                limit={20}
            />
         }
      />

      {/* Feedback Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={handleSnackbarClose} severity="info">{snackbarMessage}</Alert>
      </Snackbar>
    </Container>
  );
};

export default WebsiteDetails;