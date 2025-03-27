// src/pages/WebsiteDetails.tsx
import React, { useState, useCallback, useRef, useEffect } from "react"; // Import useRef, useEffect
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

// Chart.js registration... (remains the same)
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

// Import the hook
import { useWebsiteDetail } from "../hooks/domain/useWebsiteDetail";

// Component imports... (remains the same)
import WebsiteHeader from "../components/website-details/WebsiteHeader";
import WebsiteStatsCards from "../components/website-details/WebsiteStatsCards";
import ResponseTimeChart from "../components/website-details/ResponseTimeChart";
import UptimeChart from "../components/website-details/UptimeChart";
import DowntimePatternChart from "../components/website-details/DownTimePatternChart";
import ResultsTable from "../components/website-details/ResultsTable";
import TimeRangeSelector from "../components/website-details/TimeRangeSelector";
import WebsiteDetailsTabs from "../components/website-details/WebsiteDetailsTabs";
import { TimeRange } from "../types";

// Helper function... (remains the same)
const getAvailableTimeRanges = (tabIndex: number): TimeRange[] => {
  /* ... */
};

const WebsiteDetails: React.FC = () => {
  const params = useParams<Record<string, string>>();
  const websiteId = parseInt(params.id || "0", 10);

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");

  // Use the central hook
  const {
    userWebsite,
    results, // Filtered results based on timeRange
    allResults, // Underlying potentially larger dataset from fetch
    loading, // This reflects the underlying hook's loading state (true during polls)
    error,
    isChecking,
    handleCheckNow,
    currentStatus,
    statusColor,
    refetch,
    timeRange,
    setTimeRange,
  } = useWebsiteDetail(websiteId);

  // Ref to track if the initial data load has ever completed
  const initialLoadComplete = useRef(false);

  // Determine if initial load is truly complete
  useEffect(() => {
    // Consider load complete if we are NOT currently loading AND we have website data
    // OR if we are not loading and have some results (even if website data failed initially)
    if (!loading && (userWebsite || allResults.length > 0)) {
      initialLoadComplete.current = true;
    }
  }, [loading, userWebsite, allResults]);

  // Callback for tab changes... (remains the same)
  const handleTabChange = useCallback(
    (newTabIndex: number) => {
      setActiveTabIndex(newTabIndex);
      const newAvailableRanges = getAvailableTimeRanges(newTabIndex);
      if (!newAvailableRanges.includes(timeRange)) {
        setTimeRange(newAvailableRanges[0]);
      }
    },
    [timeRange, setTimeRange],
  );

  // Callback for time range changes... (remains the same)
  const handleTimeRangeChange = useCallback(
    (newTimeRange: TimeRange) => {
      setTimeRange(newTimeRange);
    },
    [setTimeRange],
  );

  const handleSnackbarClose = () => setSnackbarOpen(false);

  // --- Render Logic ---

  // **MODIFIED** Loading State (Initial Load Only)
  // Show full page loader only if loading AND the initial load hasn't completed yet
  if (loading && !initialLoadComplete.current) {
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
    // Check !loading to ensure it's not shown during transitions
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

  // Calculate loading state specific to charts (only true on initial load)
  // We use `allResults.length === 0` as a proxy for "no data yet"
  const showChartLoading = loading && allResults.length === 0 && !error;

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

      {/* Stats cards likely don't need a loading state if they show latest known data */}
      <WebsiteStatsCards
        latestResult={allResults.length > 0 ? allResults[0] : null}
      />

      <TimeRangeSelector
        value={timeRange}
        onChange={handleTimeRangeChange}
        availableRanges={getAvailableTimeRanges(activeTabIndex)}
      />

      {/* Render Tabs and pass chart components */}
      <WebsiteDetailsTabs
        onTabChange={handleTabChange}
        responseTimeChart={
          <ResponseTimeChart
            results={results} // Pass currently filtered results
            timeRange={timeRange}
            // **MODIFIED** Pass loading only for the initial load phase
            loading={showChartLoading && activeTabIndex === 0}
            error={error && activeTabIndex === 0 ? error : null} // Show error if relevant
          />
        }
        uptimeChart={
          <UptimeChart
            results={results}
            timeRange={timeRange}
            // **MODIFIED** Pass loading only for the initial load phase
            loading={showChartLoading && activeTabIndex === 1}
            error={error && activeTabIndex === 1 ? error : null}
          />
        }
        downtimePatternChart={
          <DowntimePatternChart
            results={results}
            timeRange={timeRange}
            // **MODIFIED** Pass loading only for the initial load phase
            loading={showChartLoading && activeTabIndex === 2}
            error={error && activeTabIndex === 2 ? error : null}
          />
        }
        resultsTable={
          <ResultsTable
            results={results} // Table uses filtered results
            timeRange={timeRange}
            // **MODIFIED** Pass loading only for the initial load phase
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
