// src/pages/WebsiteDetails.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
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
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

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
  Legend,
  Filler,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
);

// Import our hooks
import { useWebsiteDetail } from "../hooks/domain/useWebsiteDetail";
import { 
  useTimeRangeSelection, 
  useFilteredResults 
} from "../hooks";

// Component imports
import WebsiteHeader from "../components/website-details/WebsiteHeader";
import WebsiteStatsCards from "../components/website-details/WebsiteStatsCards";
import ResponseTimeChart from "../components/website-details/ResponseTimeChart";
import UptimeChart from "../components/website-details/UptimeChart";
import DowntimePatternChart from "../components/website-details/DownTimePatternChart";
import ResultsTable from "../components/website-details/ResultsTable";
import TimeRangeSelector from "../components/website-details/TimeRangeSelector";
import WebsiteDetailsTabs from "../components/website-details/WebsiteDetailsTabs";

const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const websiteId = parseInt(params.id || "0", 10);

  // Tab state
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");

  // Use the central hook for website details
  const {
    userWebsite,
    allResults, // Unfiltered data
    loading,
    error,
    isChecking,
    handleCheckNow,
    currentStatus,
    statusColor,
    refetch,
  } = useWebsiteDetail(websiteId);

  // Use our new time range selection hook
  const { timeRange, setTimeRange, availableRanges } = useTimeRangeSelection("7d", activeTabIndex);

  // Use our filtered results hook to filter results based on time range
  const filteredResults = useFilteredResults(allResults, timeRange);

  // Ref to track if the initial data load has completed
  const initialLoadComplete = useRef(false);

  // Determine if initial load is complete
  useEffect(() => {
    if (!loading && (userWebsite || allResults.length > 0)) {
      initialLoadComplete.current = true;
    }
  }, [loading, userWebsite, allResults]);

  // Callback for tab changes
  const handleTabChange = useCallback((newTabIndex: number) => {
    setActiveTabIndex(newTabIndex);
  }, []);

  // Simple handler for closing snackbar
  const handleSnackbarClose = () => setSnackbarOpen(false);

  // Simplified loading states
  const isInitialLoading = loading && !initialLoadComplete.current;
  const showChartLoading = isInitialLoading && allResults.length === 0 && !error;

  // Error State (if website data fails critically on initial load)
  if (error && !userWebsite && !initialLoadComplete.current) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <ErrorIcon color="error" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h5" color="error">
            Error Loading Website Details
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

  // Not Found / No Access State
  if (!userWebsite && !loading) {
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

  // Loading State (Initial Load Only)
  if (isInitialLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Main Content Render
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {userWebsite && (
        <WebsiteHeader
          userWebsite={userWebsite}
          currentStatus={currentStatus}
          statusColor={statusColor}
          isChecking={isChecking}
          onCheckNow={handleCheckNow}
        />
      )}

      {/* Stats cards */}
      <WebsiteStatsCards
        latestResult={allResults.length > 0 ? allResults[0] : null}
      />

      {/* Time range selector with available ranges from our hook */}
      <TimeRangeSelector
        value={timeRange}
        onChange={setTimeRange}
        availableRanges={availableRanges}
      />

      {/* Tabs with charts - passing filtered results to all chart components */}
      <WebsiteDetailsTabs
        onTabChange={handleTabChange}
        responseTimeChart={
          <ResponseTimeChart
            results={filteredResults}
            timeRange={timeRange}
            loading={showChartLoading && activeTabIndex === 0}
            error={error && activeTabIndex === 0 ? error : null}
          />
        }
        uptimeChart={
          <UptimeChart
            results={filteredResults}
            timeRange={timeRange}
            loading={showChartLoading && activeTabIndex === 1}
            error={error && activeTabIndex === 1 ? error : null}
          />
        }
        downtimePatternChart={
          <DowntimePatternChart
            results={filteredResults}
            timeRange={timeRange}
            loading={showChartLoading && activeTabIndex === 2}
            error={error && activeTabIndex === 2 ? error : null}
          />
        }
        resultsTable={
          <ResultsTable
            results={filteredResults}
            timeRange={timeRange}
            loading={showChartLoading && activeTabIndex === 3}
            limit={20}
          />
        }
      />

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleSnackbarClose} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WebsiteDetails;